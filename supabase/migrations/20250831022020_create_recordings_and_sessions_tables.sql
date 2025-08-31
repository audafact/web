-- Create recordings and sessions tables with proper structure
-- This migration restores the tables that were dropped in previous migration issues
-- Date: 2025-01-01

-- Create session_mode enum type
CREATE TYPE "public"."session_mode" AS ENUM ('loop', 'chop');

-- Create sessions table first (recordings references it)
CREATE TABLE "public"."sessions" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "session_name" text NOT NULL,
    "track_ids" uuid[] DEFAULT '{}'::uuid[],
    "cuepoints" jsonb DEFAULT '[]'::jsonb,
    "loop_regions" jsonb DEFAULT '[]'::jsonb,
    "mode" session_mode DEFAULT 'loop'::session_mode,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Create recordings table
CREATE TABLE "public"."recordings" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "session_id" uuid, -- Optional - recordings can exist without sessions
    "recording_url" text NOT NULL,
    "length" real,
    "notes" text,
    "created_at" timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."recordings" ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_sessions_user_id ON "public"."sessions" USING btree (user_id);
CREATE INDEX idx_recordings_user_id ON "public"."recordings" USING btree (user_id);
CREATE INDEX idx_recordings_session_id ON "public"."recordings" USING btree (session_id);

-- Create primary keys
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY (id);
ALTER TABLE "public"."recordings" ADD CONSTRAINT "recordings_pkey" PRIMARY KEY (id);

-- Create foreign key constraints
ALTER TABLE "public"."recordings" ADD CONSTRAINT "recordings_user_id_fkey" 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "public"."recordings" ADD CONSTRAINT "recordings_session_id_fkey" 
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Grant permissions to authenticated users
GRANT ALL ON "public"."sessions" TO authenticated;
GRANT ALL ON "public"."recordings" TO authenticated;

-- Grant permissions to anon users (for demo mode)
GRANT ALL ON "public"."sessions" TO anon;
GRANT ALL ON "public"."recordings" TO anon;

-- Add comments
COMMENT ON TABLE "public"."sessions" IS 'Stores saved studio states and project configurations';
COMMENT ON TABLE "public"."recordings" IS 'Stores performance recordings and audio captures';
COMMENT ON COLUMN "public"."sessions"."mode" IS 'Session mode: loop or chop';
COMMENT ON COLUMN "public"."recordings"."session_id" IS 'Optional reference to a session - recordings can exist independently';
COMMENT ON COLUMN "public"."recordings"."recording_url" IS 'URL or path to the recording file (legacy field for backward compatibility)';
