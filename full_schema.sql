

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."session_mode" AS ENUM (
    'loop',
    'chop'
);


ALTER TYPE "public"."session_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    current_count INTEGER;
    track_is_pro BOOLEAN;
    user_tier TEXT;
BEGIN
    -- Get user's access tier
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = user_uuid;
    
    -- Get track info
    SELECT is_pro_only INTO track_is_pro
    FROM public.library_tracks
    WHERE id = track_uuid;
    
    -- Check if user can access this track
    IF track_is_pro = true AND user_tier != 'pro' THEN
        RETURN false;
    END IF;
    
    -- For free users, check limits
    IF user_tier = 'free' THEN
        current_count := get_user_library_track_count(user_uuid);
        IF current_count >= 10 THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check if track is already in user's collection
    IF EXISTS (
        SELECT 1 FROM public.library_usage 
        WHERE user_id = user_uuid 
        AND track_id = track_uuid 
        AND is_active = true
        AND rotation_week = get_current_rotation_week()
    ) THEN
        RETURN false;
    END IF;
    
    -- Add track to user's collection
    INSERT INTO public.library_usage (user_id, track_id, rotation_week, is_active)
    VALUES (user_uuid, track_uuid, get_current_rotation_week(), true);
    
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") IS 'Adds a library track to a user collection, respecting limits';



CREATE OR REPLACE FUNCTION "public"."extract_track_id_from_file_key"("file_key" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
    filename TEXT;
    parts TEXT[];
    i INTEGER;
    track_id TEXT;
BEGIN
    -- Handle null or empty file_key
    IF file_key IS NULL OR file_key = '' THEN
        RETURN NULL;
    END IF;
    
    -- Get filename from path
    filename := split_part(file_key, '/', -1);
    
    -- Remove file extension
    filename := split_part(filename, '.', 1);
    
    -- Split by '-' to find the hash
    parts := string_to_array(filename, '-');
    track_id := '';
    
    -- Build track_id by stopping before the 10-character hash
    FOR i IN 1..array_length(parts, 1) LOOP
        -- Check if this part is a 10-character hex hash
        IF length(parts[i]) = 10 AND parts[i] ~ '^[a-f0-9]+$' THEN
            -- Found the hash, stop here
            EXIT;
        ELSE
            -- This is part of the track_id
            IF track_id = '' THEN
                track_id := parts[i];
            ELSE
                track_id := track_id || '-' || parts[i];
            END IF;
        END IF;
    END LOOP;
    
    RETURN track_id;
END;
$_$;


ALTER FUNCTION "public"."extract_track_id_from_file_key"("file_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_track_name"("track_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    parts TEXT[];
    i INTEGER;
    part TEXT;
    formatted_name TEXT;
BEGIN
    -- Handle null or empty track_id
    IF track_id IS NULL OR track_id = '' THEN
        RETURN NULL;
    END IF;
    
    -- Split by hyphens
    parts := string_to_array(track_id, '-');
    formatted_name := '';
    
    -- Process each part
    FOR i IN 1..array_length(parts, 1) LOOP
        part := parts[i];
        
        -- Skip empty parts
        IF part = '' THEN
            CONTINUE;
        END IF;
        
        -- Handle version and alternate keywords
        IF part = 'version' THEN
            formatted_name := formatted_name || ' - Version ';
            CONTINUE;
        ELSIF part = 'alt' THEN
            formatted_name := formatted_name || ' - Alternate ';
            CONTINUE;
        END IF;
        
        -- Capitalize first letter
        part := upper(substring(part, 1, 1)) || lower(substring(part, 2));
        
        -- Add to formatted name
        IF formatted_name = '' THEN
            formatted_name := part;
        ELSE
            formatted_name := formatted_name || ' ' || part;
        END IF;
    END LOOP;
    
    RETURN formatted_name;
END;
$$;


ALTER FUNCTION "public"."format_track_name"("track_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_rotation_week"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$;


ALTER FUNCTION "public"."get_current_rotation_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_free_user_tracks"() RETURNS TABLE("id" "uuid", "track_id" "text", "name" "text", "artist" "text", "genre" "text", "bpm" integer, "key" "text", "duration" integer, "file_url" "text", "type" "text", "size" "text", "tags" "text"[], "is_pro_only" boolean, "preview_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_url,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_url
    FROM public.library_tracks lt
    WHERE lt.is_active = true 
    AND lt.is_pro_only = false
    AND lt.rotation_week = get_current_rotation_week()
    ORDER BY lt.name;
END;
$$;


ALTER FUNCTION "public"."get_free_user_tracks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_free_user_tracks"() IS 'Returns tracks available for free users in the current rotation week';



CREATE OR REPLACE FUNCTION "public"."get_pro_user_tracks"() RETURNS TABLE("id" "uuid", "track_id" "text", "name" "text", "artist" "text", "bpm" integer, "key" "text", "duration" integer, "file_key" "text", "type" "text", "size" "text", "tags" "text"[], "is_pro_only" boolean, "preview_key" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_key,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_key
    FROM public.library_tracks lt
    WHERE lt.is_active = true
    ORDER BY lt.name;
END;
$$;


ALTER FUNCTION "public"."get_pro_user_tracks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pro_user_tracks"() IS 'Returns all active tracks for pro users';



CREATE OR REPLACE FUNCTION "public"."get_rotation_info"() RETURNS TABLE("current_week" integer, "next_rotation_date" "date", "days_until_rotation" integer, "current_tracks_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_monday DATE;
BEGIN
    -- Calculate next Monday
    next_monday := CURRENT_DATE + (8 - EXTRACT(DOW FROM CURRENT_DATE))::INTEGER;
    IF next_monday <= CURRENT_DATE THEN
        next_monday := next_monday + 7;
    END IF;
    
    RETURN QUERY
    SELECT 
        get_current_rotation_week() as current_week,
        next_monday as next_rotation_date,
        (next_monday - CURRENT_DATE)::INTEGER as days_until_rotation,
        COUNT(*)::INTEGER as current_tracks_count
    FROM public.library_tracks
    WHERE is_active = true 
    AND is_pro_only = false
    AND rotation_week = get_current_rotation_week();
END;
$$;


ALTER FUNCTION "public"."get_rotation_info"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_rotation_info"() IS 'Returns current rotation information including next rotation date';



CREATE OR REPLACE FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.library_usage lu
        WHERE lu.user_id = user_uuid 
        AND lu.is_active = true
        AND lu.rotation_week = get_current_rotation_week()
    );
END;
$$;


ALTER FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") IS 'Returns the number of library tracks a user has added in the current week';



CREATE OR REPLACE FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") RETURNS TABLE("id" "uuid", "track_id" "text", "name" "text", "artist" "text", "genre" "text", "bpm" integer, "key" "text", "duration" integer, "file_url" "text", "type" "text", "size" "text", "tags" "text"[], "is_pro_only" boolean, "preview_url" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.track_id,
        lt.name,
        lt.artist,
        lt.genre,
        lt.bpm,
        lt.key,
        lt.duration,
        lt.file_url,
        lt.type,
        lt.size,
        lt.tags,
        lt.is_pro_only,
        lt.preview_url
    FROM public.library_tracks lt
    INNER JOIN public.library_usage lu ON lt.id = lu.track_id
    WHERE lu.user_id = user_uuid 
    AND lu.is_active = true
    AND lu.rotation_week = get_current_rotation_week()
    ORDER BY lt.name;
END;
$$;


ALTER FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") IS 'Returns all library tracks currently in a user collection';



CREATE OR REPLACE FUNCTION "public"."get_user_tracks"("user_id" "uuid") RETURNS TABLE("track_id" "text", "name" "text", "artist" "text", "genre" "text"[], "bpm" integer, "key" "text", "duration" integer, "file_key" "text", "preview_key" "text", "type" "text", "size" "text", "tags" "text"[], "is_pro_only" boolean, "rotation_week" integer, "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Get user's access tier
  DECLARE
    user_tier TEXT;
  BEGIN
    -- Check if user exists and get their tier
    SELECT access_tier INTO user_tier
    FROM public.users
    WHERE id = user_id;
    
    -- If user doesn't exist, return no tracks (guest user)
    IF user_tier IS NULL THEN
      RETURN;
    END IF;
    
    IF user_tier = 'pro' THEN
      -- Pro users get all active tracks
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
      ORDER BY lt.rotation_week DESC, lt.name;
      
    ELSIF user_tier = 'free' THEN
      -- Free users get tracks from current rotation week (limited to 10)
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
        AND lt.rotation_week = get_current_rotation_week()
        AND lt.is_pro_only = false
      ORDER BY lt.name
      LIMIT 10;
      
    ELSE
      -- Unknown tier or guest users get no tracks (they use bundled tracks)
      RETURN;
    END IF;
  END;
END;
$$;


ALTER FUNCTION "public"."get_user_tracks"("user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_tracks"("user_id" "uuid") IS 'Returns tracks based on user tier: pro users get all tracks, free users get 10 tracks from current rotation week, guest users get none';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, access_tier)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.library_usage
    SET is_active = false
    WHERE user_id = user_uuid 
    AND track_id = track_uuid 
    AND is_active = true;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") IS 'Removes a library track from a user collection';



CREATE OR REPLACE FUNCTION "public"."rotate_free_user_tracks"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_week INTEGER;
    available_tracks UUID[];
BEGIN
    next_week := get_current_rotation_week() + 1;
    
    -- Select 3 tracks that haven't been in rotation recently
    SELECT ARRAY_AGG(id) INTO available_tracks
    FROM (
        SELECT id FROM public.library_tracks
        WHERE is_active = true 
        AND is_pro_only = false
        AND (rotation_week IS NULL OR rotation_week < get_current_rotation_week() - 4)
        ORDER BY RANDOM()
        LIMIT 3
    ) AS available;
    
    -- Update rotation week for selected tracks
    IF available_tracks IS NOT NULL THEN
        UPDATE public.library_tracks
        SET rotation_week = next_week
        WHERE id = ANY(available_tracks);
    END IF;
    
    -- Clean up old usage records (older than 8 weeks)
    DELETE FROM public.library_usage
    WHERE rotation_week < get_current_rotation_week() - 8;
END;
$$;


ALTER FUNCTION "public"."rotate_free_user_tracks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rotate_free_user_tracks"() IS 'Automatically rotates 3 tracks for the next week';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_schema_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- This function can be used in future migrations to validate changes
    -- For now, it just logs that the schema is protected
    RAISE NOTICE 'Schema validation: % table structure is protected', TG_TABLE_NAME;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_schema_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_schema_changes"() IS 'Schema validation function - use in future migrations to prevent accidental structure changes';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."library_tracks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "track_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "artist" "text",
    "genre" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "bpm" integer,
    "key" "text",
    "duration" integer,
    "type" "text" NOT NULL,
    "size" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_pro_only" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "rotation_week" integer,
    "file_key" "text",
    "preview_key" "text",
    "short_hash" "text",
    "content_hash" "text",
    "size_bytes" bigint,
    "content_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "library_tracks_type_check" CHECK (("type" = ANY (ARRAY['wav'::"text", 'mp3'::"text"])))
);


ALTER TABLE "public"."library_tracks" OWNER TO "postgres";


COMMENT ON TABLE "public"."library_tracks" IS 'SCHEMA_LOCKED: Library tracks with R2 storage integration - DO NOT MODIFY STRUCTURE';



COMMENT ON COLUMN "public"."library_tracks"."file_key" IS 'R2 storage file key for the main audio file';



COMMENT ON COLUMN "public"."library_tracks"."preview_key" IS 'R2 storage file key for the preview audio file';



COMMENT ON COLUMN "public"."library_tracks"."short_hash" IS 'Short hash identifier for the audio file';



COMMENT ON COLUMN "public"."library_tracks"."content_hash" IS 'Full content hash for file integrity verification';



COMMENT ON COLUMN "public"."library_tracks"."size_bytes" IS 'File size in bytes';



COMMENT ON COLUMN "public"."library_tracks"."content_type" IS 'MIME type of the audio file';



CREATE TABLE IF NOT EXISTS "public"."library_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "track_id" "uuid" NOT NULL,
    "rotation_week" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."library_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."library_usage" IS 'Tracks which library tracks users have added to their collection';



CREATE TABLE IF NOT EXISTS "public"."recordings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "recording_url" "text" NOT NULL,
    "length" real,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "file_key" "text",
    "content_hash" "text",
    "size_bytes" bigint,
    "content_type" "text",
    "original_name" "text"
);


ALTER TABLE "public"."recordings" OWNER TO "postgres";


COMMENT ON TABLE "public"."recordings" IS 'Stores performance recordings and audio captures';



COMMENT ON COLUMN "public"."recordings"."session_id" IS 'Optional reference to a session - recordings can exist independently';



COMMENT ON COLUMN "public"."recordings"."recording_url" IS 'URL or path to the recording file (legacy field for backward compatibility)';



COMMENT ON COLUMN "public"."recordings"."file_key" IS 'R2 storage key for the recording file (e.g., sessions/{userId}/{recordingId}-{hash}.wav)';



COMMENT ON COLUMN "public"."recordings"."content_hash" IS 'SHA-256 hash of the recording content for deduplication';



COMMENT ON COLUMN "public"."recordings"."size_bytes" IS 'File size in bytes';



COMMENT ON COLUMN "public"."recordings"."content_type" IS 'MIME type of the recording file';



COMMENT ON COLUMN "public"."recordings"."original_name" IS 'Original filename of the recording';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_name" "text" NOT NULL,
    "track_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "cuepoints" "jsonb" DEFAULT '[]'::"jsonb",
    "loop_regions" "jsonb" DEFAULT '[]'::"jsonb",
    "mode" "public"."session_mode" DEFAULT 'loop'::"public"."session_mode",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."sessions" IS 'Stores saved studio states and project configurations';



COMMENT ON COLUMN "public"."sessions"."mode" IS 'Session mode: loop or chop';



CREATE TABLE IF NOT EXISTS "public"."track_rotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "week_number" integer NOT NULL,
    "track_ids" "text"[] NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."track_rotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."track_rotations" IS 'SCHEMA_LOCKED: Track rotation schedule for free users - DO NOT MODIFY STRUCTURE';



CREATE TABLE IF NOT EXISTS "public"."uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_key" "text" NOT NULL,
    "file_size" bigint,
    "content_hash" "text",
    "mime_type" "text",
    "original_filename" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."uploads" OWNER TO "postgres";


COMMENT ON TABLE "public"."uploads" IS 'SCHEMA_LOCKED: User file uploads with R2 storage integration - DO NOT MODIFY STRUCTURE';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "access_tier" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "subscription_id" "text",
    "plan_interval" "text",
    "price_id" "text",
    CONSTRAINT "users_plan_interval_check" CHECK (("plan_interval" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'SCHEMA_LOCKED: User profiles and subscription information - DO NOT MODIFY STRUCTURE';



ALTER TABLE ONLY "public"."library_tracks"
    ADD CONSTRAINT "library_tracks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."library_tracks"
    ADD CONSTRAINT "library_tracks_track_id_key" UNIQUE ("track_id");



ALTER TABLE ONLY "public"."library_usage"
    ADD CONSTRAINT "library_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recordings"
    ADD CONSTRAINT "recordings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uploads"
    ADD CONSTRAINT "uploads_file_key_unique" UNIQUE ("file_key");



ALTER TABLE ONLY "public"."uploads"
    ADD CONSTRAINT "uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_library_tracks_content_hash" ON "public"."library_tracks" USING "btree" ("content_hash");



CREATE INDEX "idx_library_tracks_file_key" ON "public"."library_tracks" USING "btree" ("file_key");



CREATE INDEX "idx_library_tracks_is_active" ON "public"."library_tracks" USING "btree" ("is_active");



CREATE INDEX "idx_library_tracks_is_pro_only" ON "public"."library_tracks" USING "btree" ("is_pro_only");



CREATE INDEX "idx_library_tracks_preview_key" ON "public"."library_tracks" USING "btree" ("preview_key");



CREATE INDEX "idx_library_tracks_rotation_week" ON "public"."library_tracks" USING "btree" ("rotation_week");



CREATE INDEX "idx_library_tracks_short_hash" ON "public"."library_tracks" USING "btree" ("short_hash");



CREATE INDEX "idx_library_tracks_size_bytes" ON "public"."library_tracks" USING "btree" ("size_bytes");



CREATE INDEX "idx_library_usage_active" ON "public"."library_usage" USING "btree" ("is_active");



CREATE INDEX "idx_library_usage_rotation_week" ON "public"."library_usage" USING "btree" ("rotation_week");



CREATE INDEX "idx_library_usage_track_id" ON "public"."library_usage" USING "btree" ("track_id");



CREATE INDEX "idx_library_usage_user_id" ON "public"."library_usage" USING "btree" ("user_id");



CREATE INDEX "idx_recordings_content_hash" ON "public"."recordings" USING "btree" ("content_hash");



CREATE INDEX "idx_recordings_file_key" ON "public"."recordings" USING "btree" ("file_key");



CREATE INDEX "idx_recordings_session_id" ON "public"."recordings" USING "btree" ("session_id");



CREATE INDEX "idx_recordings_size_bytes" ON "public"."recordings" USING "btree" ("size_bytes");



CREATE INDEX "idx_recordings_user_id" ON "public"."recordings" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_track_rotations_is_active" ON "public"."track_rotations" USING "btree" ("is_active");



CREATE INDEX "idx_track_rotations_week_number" ON "public"."track_rotations" USING "btree" ("week_number");



CREATE INDEX "idx_uploads_created_at" ON "public"."uploads" USING "btree" ("created_at");



CREATE INDEX "idx_uploads_file_key" ON "public"."uploads" USING "btree" ("file_key");



CREATE INDEX "idx_uploads_user_id" ON "public"."uploads" USING "btree" ("user_id");



CREATE INDEX "idx_users_access_tier" ON "public"."users" USING "btree" ("access_tier");



CREATE INDEX "idx_users_stripe_customer_id" ON "public"."users" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_users_subscription_id" ON "public"."users" USING "btree" ("subscription_id");



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."library_usage"
    ADD CONSTRAINT "library_usage_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "public"."library_tracks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."library_usage"
    ADD CONSTRAINT "library_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recordings"
    ADD CONSTRAINT "recordings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recordings"
    ADD CONSTRAINT "recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uploads"
    ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view library tracks" ON "public"."library_tracks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view track rotations" ON "public"."track_rotations" FOR SELECT USING (true);



CREATE POLICY "Service role can manage library tracks" ON "public"."library_tracks" TO "service_role" USING (true);



CREATE POLICY "Service role can manage library usage" ON "public"."library_usage" TO "service_role" USING (true);



CREATE POLICY "Service role can manage track rotations" ON "public"."track_rotations" TO "service_role" USING (true);



CREATE POLICY "Users can delete their own uploads" ON "public"."uploads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own data" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own library usage" ON "public"."library_usage" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own uploads" ON "public"."uploads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own library usage" ON "public"."library_usage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own uploads" ON "public"."uploads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own library usage" ON "public"."library_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own uploads" ON "public"."uploads" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."library_tracks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."library_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recordings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."track_rotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_library_track_to_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_track_id_from_file_key"("file_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_track_id_from_file_key"("file_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_track_id_from_file_key"("file_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."format_track_name"("track_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."format_track_name"("track_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_track_name"("track_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_free_user_tracks"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_free_user_tracks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_free_user_tracks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pro_user_tracks"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pro_user_tracks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pro_user_tracks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_rotation_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_rotation_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_rotation_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_library_track_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_library_tracks"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tracks"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tracks"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tracks"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_library_track_from_user"("user_uuid" "uuid", "track_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_free_user_tracks"() TO "anon";
GRANT ALL ON FUNCTION "public"."rotate_free_user_tracks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rotate_free_user_tracks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "service_role";


















GRANT ALL ON TABLE "public"."library_tracks" TO "anon";
GRANT ALL ON TABLE "public"."library_tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."library_tracks" TO "service_role";



GRANT ALL ON TABLE "public"."library_usage" TO "anon";
GRANT ALL ON TABLE "public"."library_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."library_usage" TO "service_role";



GRANT ALL ON TABLE "public"."recordings" TO "anon";
GRANT ALL ON TABLE "public"."recordings" TO "authenticated";
GRANT ALL ON TABLE "public"."recordings" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."track_rotations" TO "anon";
GRANT ALL ON TABLE "public"."track_rotations" TO "authenticated";
GRANT ALL ON TABLE "public"."track_rotations" TO "service_role";



GRANT ALL ON TABLE "public"."uploads" TO "anon";
GRANT ALL ON TABLE "public"."uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."uploads" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
