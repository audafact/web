alter table "public"."track_rotations" drop constraint "track_rotations_pkey";

drop index if exists "public"."idx_library_tracks_genre";

drop index if exists "public"."track_rotations_pkey";

alter table "public"."library_tracks" alter column "genre" set default '{}'::text[];

alter table "public"."library_tracks" alter column "genre" set data type text[] using "genre"::text[];

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_current_rotation_week()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Calculate week number since a reference date (e.g., 2024-01-01)
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$function$
;


