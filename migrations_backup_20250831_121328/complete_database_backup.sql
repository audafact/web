

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."get_current_rotation_week"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Calculate week number since a reference date (e.g., 2024-01-01)
    RETURN FLOOR(EXTRACT(EPOCH FROM (CURRENT_DATE - DATE '2024-01-01')) / (7 * 24 * 60 * 60));
END;
$$;


ALTER FUNCTION "public"."get_current_rotation_week"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, access_tier, created_at, updated_at)
  VALUES (NEW.id, 'free', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


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
    "bpm" integer,
    "key" "text",
    "duration" integer,
    "type" "text" NOT NULL,
    "size" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_pro_only" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "rotation_week" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "genre" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "file_key" "text",
    "preview_key" "text",
    "short_hash" "text",
    "content_hash" "text",
    "size_bytes" bigint,
    "content_type" "text",
    CONSTRAINT "library_tracks_type_check" CHECK (("type" = ANY (ARRAY['wav'::"text", 'mp3'::"text"])))
);


ALTER TABLE "public"."library_tracks" OWNER TO "postgres";


COMMENT ON TABLE "public"."library_tracks" IS 'SCHEMA_LOCKED: Library tracks with R2 storage integration - DO NOT MODIFY STRUCTURE';



COMMENT ON COLUMN "public"."library_tracks"."file_key" IS 'R2 storage key for the main audio file (e.g., library/originals/trackId-hash.ext)';



COMMENT ON COLUMN "public"."library_tracks"."preview_key" IS 'R2 storage key for the preview file (e.g., library/previews/trackId-hash.mp3)';



COMMENT ON COLUMN "public"."library_tracks"."short_hash" IS 'Short hash identifier for the file (e.g., a1b2c3d4)';



COMMENT ON COLUMN "public"."library_tracks"."content_hash" IS 'SHA-256 hash of the file content for deduplication';



COMMENT ON COLUMN "public"."library_tracks"."size_bytes" IS 'File size in bytes';



COMMENT ON COLUMN "public"."library_tracks"."content_type" IS 'MIME type of the file';



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



CREATE INDEX "idx_track_rotations_is_active" ON "public"."track_rotations" USING "btree" ("is_active");



CREATE INDEX "idx_track_rotations_week_number" ON "public"."track_rotations" USING "btree" ("week_number");



CREATE INDEX "idx_uploads_created_at" ON "public"."uploads" USING "btree" ("created_at");



CREATE INDEX "idx_uploads_file_key" ON "public"."uploads" USING "btree" ("file_key");



CREATE INDEX "idx_uploads_user_id" ON "public"."uploads" USING "btree" ("user_id");



CREATE INDEX "idx_users_access_tier" ON "public"."users" USING "btree" ("access_tier");



CREATE INDEX "idx_users_stripe_customer_id" ON "public"."users" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_users_subscription_id" ON "public"."users" USING "btree" ("subscription_id");



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."uploads"
    ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view library tracks" ON "public"."library_tracks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view track rotations" ON "public"."track_rotations" FOR SELECT USING (true);



CREATE POLICY "Service role can manage library tracks" ON "public"."library_tracks" TO "service_role" USING (true);



CREATE POLICY "Service role can manage track rotations" ON "public"."track_rotations" TO "service_role" USING (true);



CREATE POLICY "Users can delete their own uploads" ON "public"."uploads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own data" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own uploads" ON "public"."uploads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own uploads" ON "public"."uploads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own uploads" ON "public"."uploads" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."library_tracks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."track_rotations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_rotation_week"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_schema_changes"() TO "service_role";



GRANT ALL ON TABLE "public"."library_tracks" TO "anon";
GRANT ALL ON TABLE "public"."library_tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."library_tracks" TO "service_role";



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
