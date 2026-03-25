-- Tiered library gating: track family / variant metadata + capped get_user_tracks
-- Free: 15 tracks, max 1 variant per family. Starter: 35 tracks, max 2 per family.
-- Pro / enterprise: all active tracks.

ALTER TABLE public.library_tracks
  ADD COLUMN IF NOT EXISTS family_id TEXT,
  ADD COLUMN IF NOT EXISTS variant_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (variant_type IN ('primary', 'version', 'alternate')),
  ADD COLUMN IF NOT EXISTS variant_number INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_rank INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.library_tracks.family_id IS 'Stable group for the same composition (versions vs alternates are separate families when keyed from file slug).';
COMMENT ON COLUMN public.library_tracks.variant_type IS 'primary = main cut; version / alternate = alternate cuts of the same titled work.';
COMMENT ON COLUMN public.library_tracks.variant_number IS '0 for primary; 1+ for version/alternate index from filename.';
COMMENT ON COLUMN public.library_tracks.display_rank IS 'Lower sorts first within tier picks (derived from rotation etc.).';

CREATE INDEX IF NOT EXISTS idx_library_tracks_active_family
  ON public.library_tracks (is_active, family_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_library_tracks_tier_select
  ON public.library_tracks (is_active, is_pro_only, family_id, variant_type, variant_number);

-- Derive family + variant from R2 file_key basename (authoritative for versioning).
-- Versions and alternates use different family_id suffixes so one free-tier slot is not
-- shared across both lanes for the same titled composition.
UPDATE public.library_tracks lt
SET
  variant_type = derived.variant_type,
  variant_number = derived.variant_number,
  family_id = derived.family_id,
  display_rank = derived.display_rank
FROM (
  SELECT
    id,
    (comp_slug ||
      CASE v_kind
        WHEN 'alt' THEN '::alt'
        WHEN 'ver' THEN '::ver'
        ELSE ''
      END
    ) AS family_id,
    CASE v_kind
      WHEN 'alt' THEN 'alternate'
      WHEN 'ver' THEN 'version'
      ELSE 'primary'
    END::text AS variant_type,
    CASE v_kind
      WHEN 'alt' THEN (regexp_match(base_before_hash, '-alt-([0-9]+)$'))[1]::integer
      WHEN 'ver' THEN (regexp_match(base_before_hash, '-version-([0-9]+)$'))[1]::integer
      ELSE 0
    END AS variant_number,
    (- COALESCE(rotation_week, 0)) AS display_rank
  FROM (
    SELECT
      id,
      rotation_week,
      base_before_hash,
      CASE
        WHEN base_before_hash ~ '-alt-[0-9]+$' THEN 'alt'
        WHEN base_before_hash ~ '-version-[0-9]+$' THEN 'ver'
        ELSE 'primary'
      END AS v_kind,
      lower(
        trim(both '-' FROM regexp_replace(
          regexp_replace(
            CASE
              WHEN base_before_hash ~ '-alt-[0-9]+$' THEN regexp_replace(base_before_hash, '-alt-[0-9]+$', '')
              WHEN base_before_hash ~ '-version-[0-9]+$' THEN regexp_replace(base_before_hash, '-version-[0-9]+$', '')
              ELSE base_before_hash
            END,
            '[^a-zA-Z0-9]+',
            '-',
            'g'
          ),
          '-{2,}',
          '-',
          'g'
        ))
      ) AS comp_slug
    FROM (
      SELECT
        id,
        rotation_week,
        regexp_replace(
          regexp_replace(regexp_replace(file_key, '^.*/', ''), '\.[^.]+$', ''),
          '-[a-f0-9]{10}$',
          ''
        ) AS base_before_hash
      FROM public.library_tracks
    ) h
  ) s
) derived
WHERE lt.id = derived.id;

-- Safety: never NULL family_id
UPDATE public.library_tracks
SET family_id = lower(
  trim(both '-' FROM regexp_replace(
    regexp_replace(coalesce(track_id, name), '[^a-zA-Z0-9]+', '-', 'g'),
    '-{2,}',
    '-',
    'g'
  ))
)
WHERE family_id IS NULL OR family_id = '';

CREATE OR REPLACE FUNCTION get_user_tracks(user_id UUID)
RETURNS TABLE (
  track_id TEXT,
  name TEXT,
  artist TEXT,
  genre TEXT[],
  bpm INTEGER,
  key TEXT,
  duration INTEGER,
  file_key TEXT,
  preview_key TEXT,
  type TEXT,
  size TEXT,
  tags TEXT[],
  is_pro_only BOOLEAN,
  rotation_week INTEGER,
  is_active BOOLEAN
) AS $$
DECLARE
  user_tier TEXT;
  v_cap INTEGER;
  v_max_pick INTEGER;
BEGIN
  SELECT lower(access_tier::text) INTO user_tier
  FROM public.users
  WHERE id = user_id;

  IF user_tier IS NULL THEN
    RETURN;
  END IF;

  IF user_tier IN ('pro', 'enterprise') THEN
    RETURN QUERY
    SELECT
      lt.track_id,
      lt.name,
      lt.artist,
      lt.genre,
      lt.bpm,
      lt.key,
      lt.duration,
      lt.file_key,
      lt.preview_key,
      lt.type,
      lt.size,
      lt.tags,
      lt.is_pro_only,
      lt.rotation_week,
      lt.is_active
    FROM public.library_tracks lt
    WHERE lt.is_active = true
    ORDER BY
      lt.rotation_week DESC NULLS LAST,
      lt.family_id,
      CASE lt.variant_type WHEN 'primary' THEN 0 WHEN 'version' THEN 1 WHEN 'alternate' THEN 2 ELSE 3 END,
      lt.variant_number,
      lt.display_rank,
      lt.name,
      lt.track_id;
    RETURN;
  END IF;

  IF user_tier = 'starter' THEN
    v_cap := 35;
    v_max_pick := 2;
  ELSIF user_tier = 'free' THEN
    v_cap := 15;
    v_max_pick := 1;
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      lt.*,
      CASE lt.variant_type
        WHEN 'primary' THEN 0
        WHEN 'version' THEN 1
        WHEN 'alternate' THEN 2
        ELSE 3
      END AS type_ord
    FROM public.library_tracks lt
    WHERE lt.is_active = true
      AND lt.is_pro_only = false
  ),
  per_family AS (
    SELECT
      b.*,
      row_number() OVER (
        PARTITION BY b.family_id
        ORDER BY
          b.type_ord,
          b.variant_number,
          b.display_rank,
          b.name,
          b.track_id
      ) AS pick_n
    FROM base b
  ),
  family_order AS (
    SELECT
      pf.family_id,
      row_number() OVER (
        ORDER BY
          min(pf.display_rank) FILTER (WHERE pf.pick_n = 1),
          min(pf.name) FILTER (WHERE pf.pick_n = 1),
          min(pf.track_id) FILTER (WHERE pf.pick_n = 1)
      ) AS fo
    FROM per_family pf
    WHERE pf.pick_n = 1
    GROUP BY pf.family_id
  ),
  candidates AS (
    SELECT
      pf.track_id,
      pf.name,
      pf.artist,
      pf.genre,
      pf.bpm,
      pf.key,
      pf.duration,
      pf.file_key,
      pf.preview_key,
      pf.type,
      pf.size,
      pf.tags,
      pf.is_pro_only,
      pf.rotation_week,
      pf.is_active,
      row_number() OVER (
        ORDER BY
          pf.pick_n,
          fo.fo,
          pf.type_ord,
          pf.variant_number,
          pf.name,
          pf.track_id
      ) AS sel_rn
    FROM per_family pf
    INNER JOIN family_order fo ON fo.family_id = pf.family_id
    WHERE pf.pick_n <= v_max_pick
  )
  SELECT
    c.track_id,
    c.name,
    c.artist,
    c.genre,
    c.bpm,
    c.key,
    c.duration,
    c.file_key,
    c.preview_key,
    c.type,
    c.size,
    c.tags,
    c.is_pro_only,
    c.rotation_week,
    c.is_active
  FROM candidates c
  WHERE c.sel_rn <= v_cap
  ORDER BY c.sel_rn;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tracks(UUID) IS
  'Pro/enterprise: all active tracks. Free: up to 15 non-pro tracks, 1 per family. Starter: up to 35, 2 per family. Picks prioritize breadth (all first choices) then second variants.';

CREATE OR REPLACE FUNCTION user_has_library_file_access(p_user_id UUID, p_file_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;
  IF p_file_key IS NULL OR length(trim(p_file_key)) = 0 THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM get_user_tracks(p_user_id) t
    WHERE t.file_key = p_file_key
       OR t.preview_key = p_file_key
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION user_has_library_file_access(UUID, TEXT) IS
  'True if the signed-in user tier may stream/download this library original or preview key.';

GRANT EXECUTE ON FUNCTION user_has_library_file_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_library_file_access(UUID, TEXT) TO service_role;
