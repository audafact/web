import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

async function showHashKeys() {
  try {
    console.log("🔍 Fetching hash-based keys from database...\n");

    const { data, error } = await supabase
      .from("library_tracks")
      .select("track_id, name, file_key, content_hash")
      .order("name")
      .limit(10);

    if (error) {
      console.error("❌ Error fetching tracks:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.log("❌ No tracks found in database");
      return;
    }

    console.log(`📊 Found ${data.length} tracks with hash-based keys:\n`);

    data.forEach((track, index) => {
      console.log(`${index + 1}. ${track.name}`);
      console.log(`   Track ID: ${track.track_id}`);
      console.log(`   File Key: ${track.file_key}`);
      console.log(`   Hash: ${track.content_hash?.slice(0, 10)}...`);
      console.log("");
    });

    console.log("🎯 Use one of these file_key values to test the Worker API!");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

showHashKeys();
