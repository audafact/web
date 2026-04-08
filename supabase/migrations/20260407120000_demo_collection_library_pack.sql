-- Demo-only library collections: DB-backed kill switch + segregated tracks excluded from get_user_tracks.

-- 1) App config (no client access; RPCs read via SECURITY DEFINER)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_config IS 'Internal feature toggles; managed via service role / SQL; not exposed to anon/authenticated via RLS.';

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated = deny reads/writes for JWT clients

CREATE OR REPLACE FUNCTION public.set_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_config_updated_at ON public.app_config;
CREATE TRIGGER trg_app_config_updated_at
  BEFORE INSERT OR UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_app_config_updated_at();

-- Default off until you enable for the demo session
INSERT INTO public.app_config (key, value)
VALUES (
  'demo_collection.cristian_sigler_drum_pack_v1',
  '{"enabled": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.library_tracks
  ADD COLUMN IF NOT EXISTS demo_collection_slug TEXT;

COMMENT ON COLUMN public.library_tracks.demo_collection_slug IS
  'When set, track is excluded from get_user_tracks and only returned via get_demo_collection_tracks for allowlisted users when enabled in app_config.';

CREATE INDEX IF NOT EXISTS idx_library_tracks_demo_collection_slug
  ON public.library_tracks (demo_collection_slug)
  WHERE demo_collection_slug IS NOT NULL;

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.demo_collection_is_enabled(p_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value->>'enabled')::boolean
     FROM public.app_config
     WHERE key = p_slug),
    false
  );
$$;

COMMENT ON FUNCTION public.demo_collection_is_enabled(TEXT) IS
  'Reads app_config for the given collection key; false if missing or enabled not true.';

CREATE OR REPLACE FUNCTION public.demo_collection_user_allowed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(COALESCE(
    (SELECT email FROM auth.users WHERE id = p_user_id),
    ''
  ))) = 'demo@audafact.com';
$$;

COMMENT ON FUNCTION public.demo_collection_user_allowed(UUID) IS
  'True when user email is demo@audafact.com (internal demos).';

-- 3) Replace get_user_tracks — exclude demo collection rows
CREATE OR REPLACE FUNCTION public.get_user_tracks(user_id UUID)
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
      AND lt.demo_collection_slug IS NULL
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
      AND lt.demo_collection_slug IS NULL
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

COMMENT ON FUNCTION public.get_user_tracks(UUID) IS
  'Standard catalog only (demo_collection_slug IS NULL). Pro/enterprise: all active. Free/starter: capped picks per family.';

-- 4) Demo pack RPC: caller must be authenticated demo user; uses auth.uid() only
CREATE OR REPLACE FUNCTION public.get_demo_collection_tracks(p_slug TEXT)
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.demo_collection_user_allowed(auth.uid())
     OR NOT public.demo_collection_is_enabled(p_slug) THEN
    RETURN;
  END IF;

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
    AND lt.demo_collection_slug = p_slug
  ORDER BY
    lt.display_rank,
    lt.name,
    lt.track_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_demo_collection_tracks(TEXT) IS
  'Returns demo-collection tracks for demo@audafact.com when app_config enables the slug.';

GRANT EXECUTE ON FUNCTION public.get_demo_collection_tracks(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_collection_tracks(TEXT) TO service_role;

-- 5) Library file access: standard catalog OR enabled demo row for demo user
CREATE OR REPLACE FUNCTION public.user_has_library_file_access(p_user_id UUID, p_file_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;
  IF p_file_key IS NULL OR length(trim(p_file_key)) = 0 THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_user_tracks(p_user_id) t
    WHERE t.file_key = p_file_key
       OR t.preview_key = p_file_key
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.library_tracks lt
    WHERE lt.is_active = true
      AND lt.demo_collection_slug IS NOT NULL
      AND (lt.file_key = p_file_key OR lt.preview_key = p_file_key)
      AND public.demo_collection_user_allowed(p_user_id)
      AND public.demo_collection_is_enabled(lt.demo_collection_slug)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.user_has_library_file_access(UUID, TEXT) IS
  'True if tier allows this library key, or demo user + enabled demo collection row matches key.';

-- 6) RLS: stop leaking demo file keys to other users
DROP POLICY IF EXISTS "Anyone can view library tracks" ON public.library_tracks;

CREATE POLICY "library_tracks_select_catalog_or_allowed_demo"
  ON public.library_tracks
  FOR SELECT
  TO public
  USING (
    demo_collection_slug IS NULL
    OR (
      auth.uid() IS NOT NULL
      AND public.demo_collection_user_allowed(auth.uid())
      AND public.demo_collection_is_enabled(demo_collection_slug)
    )
  );

-- RLS policy expressions invoke these helpers as the querying role
GRANT EXECUTE ON FUNCTION public.demo_collection_is_enabled(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.demo_collection_user_allowed(UUID) TO PUBLIC;
