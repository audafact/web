import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabase() {
  try {
    console.log("🔍 Checking library_tracks table...\n");

    // Check the specific track we're looking for
    const trackId = "break-the-chains-version-1";
    console.log(`Looking for track_id: ${trackId}`);

    const { data, error } = await supabase
      .from("library_tracks")
      .select("id, track_id, name, file_key, is_pro_only")
      .eq("track_id", trackId);

    if (error) {
      console.error("❌ Database error:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.log("❌ No track found with that track_id");

      // Let's see what track_ids we actually have
      console.log("\n🔍 Checking what track_ids exist...");
      const { data: allTracks, error: allError } = await supabase
        .from("library_tracks")
        .select("track_id, name")
        .limit(10);

      if (allError) {
        console.error("❌ Error getting all tracks:", allError);
        return;
      }

      console.log("Available track_ids:");
      allTracks.forEach((track, index) => {
        console.log(`  ${index + 1}. ${track.track_id} -> ${track.name}`);
      });
    } else {
      console.log("✅ Track found:");
      data.forEach((track) => {
        console.log(`  ID: ${track.id}`);
        console.log(`  Track ID: ${track.track_id}`);
        console.log(`  Name: ${track.name}`);
        console.log(`  File Key: ${track.file_key}`);
        console.log(`  Is Pro Only: ${track.is_pro_only}`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkDatabase();
