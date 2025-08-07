import { createClient } from "@supabase/supabase-js";
import readline from "readline";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

class TrackRotationManager {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get current rotation week
   */
  async getCurrentRotationWeek() {
    const { data, error } = await this.supabase.rpc(
      "get_current_rotation_week"
    );
    if (error) throw error;
    return data;
  }

  /**
   * Get rotation information
   */
  async getRotationInfo() {
    const { data, error } = await this.supabase.rpc("get_rotation_info");
    if (error) throw error;
    return data?.[0] || null;
  }

  /**
   * Get all available tracks
   */
  async getAllTracks() {
    const { data, error } = await this.supabase
      .from("library_tracks")
      .select("*")
      .eq("is_active", true)
      .eq("is_pro_only", false)
      .order("name");

    if (error) throw error;
    return data;
  }

  /**
   * Get tracks for a specific rotation week
   */
  async getTracksForWeek(weekNumber) {
    console.log(`Looking for tracks in week ${weekNumber}`);

    const { data, error } = await this.supabase
      .from("library_tracks")
      .select("*")
      .eq("is_active", true)
      .eq("is_pro_only", false)
      .eq("rotation_week", weekNumber)
      .order("name");

    if (error) throw error;

    console.log(
      `Found ${data.length} tracks for week ${weekNumber}:`,
      data.map((t) => t.name)
    );
    return data;
  }

  /**
   * Get free user tracks (current rotation)
   */
  async getFreeUserTracks() {
    const { data, error } = await this.supabase.rpc("get_free_user_tracks");
    if (error) throw error;
    return data || [];
  }

  /**
   * Set rotation week for tracks
   */
  async setRotationWeek(trackIds, weekNumber) {
    console.log(`Setting week ${weekNumber} for tracks:`, trackIds);

    const { error } = await this.supabase
      .from("library_tracks")
      .update({ rotation_week: weekNumber })
      .in("track_id", trackIds);

    if (error) throw error;
    console.log(
      `Set rotation week ${weekNumber} for ${trackIds.length} tracks`
    );
  }

  /**
   * Clear rotation week for tracks (make them inactive for free users)
   */
  async clearRotationWeek(trackIds) {
    const { error } = await this.supabase
      .from("library_tracks")
      .update({ rotation_week: null })
      .in("track_id", trackIds);

    if (error) throw error;
    console.log(`Cleared rotation week for ${trackIds.length} tracks`);
  }

  /**
   * Use the new automated rotation function
   */
  async rotateToNextWeek() {
    console.log("🔄 Using automated rotation function...");

    const { data, error } = await this.supabase.rpc("rotate_free_user_tracks");

    if (error) {
      console.error("❌ Error during automated rotation:", error);
      throw error;
    }

    console.log("✅ Automated rotation completed successfully!");

    // Get updated rotation info
    const rotationInfo = await this.getRotationInfo();
    if (rotationInfo) {
      console.log("\n📊 Rotation Summary:");
      console.log(`   Current Week: ${rotationInfo.current_week}`);
      console.log(`   Available Tracks: ${rotationInfo.current_track_count}`);
      console.log(`   Next Rotation: ${rotationInfo.next_rotation_date}`);
      console.log(
        `   Days Until Rotation: ${rotationInfo.days_until_rotation}`
      );
    }

    // Show current free user tracks
    const freeTracks = await this.getFreeUserTracks();
    console.log("\n🎵 Current Free User Tracks:");
    freeTracks.forEach((track, index) => {
      console.log(`   ${index + 1}. ${track.name} (${track.genre})`);
    });
  }

  /**
   * Get user library usage statistics
   * Note: No longer tracking individual user usage since the limit is on library availability
   */
  async getUserUsageStats() {
    console.log("\n📊 User Library Usage Statistics:");
    console.log("Note: We no longer track individual user library usage.");
    console.log(
      "The 10-track limit applies to library availability, not studio usage."
    );
    console.log(
      "Free users can add all available library tracks to their studio."
    );
  }

  /**
   * Show current rotation status
   */
  async showStatus() {
    const rotationInfo = await this.getRotationInfo();
    const currentTracks = await this.getFreeUserTracks();
    const allTracks = await this.getAllTracks();

    console.log("\n=== Track Rotation Status ===");
    if (rotationInfo) {
      console.log(`Current Week: ${rotationInfo.current_week}`);
      console.log(`Available Tracks: ${rotationInfo.current_track_count}/10`);
      console.log(`Next Rotation: ${rotationInfo.next_rotation_date}`);
      console.log(`Days Until Rotation: ${rotationInfo.days_until_rotation}`);
    }
    console.log(`\nCurrent Tracks (${currentTracks.length}):`);
    currentTracks.forEach((track) => {
      console.log(`  - ${track.name} (${track.genre})`);
    });
    console.log(`\nTotal Available Tracks: ${allTracks.length}`);
    console.log("=============================\n");
  }

  /**
   * List all tracks with their rotation weeks
   */
  async listAllTracks() {
    try {
      const { data, error } = await this.supabase
        .from("library_tracks")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      console.log("\n=== All Library Tracks ===");
      data.forEach((track) => {
        const rotationInfo = track.rotation_week
          ? `Week ${track.rotation_week}`
          : track.is_pro_only
          ? "Pro Only"
          : "No Rotation";
        console.log(`  - ${track.name} (${track.genre}) - ${rotationInfo}`);
      });
      console.log("==========================\n");
    } catch (error) {
      console.error("Error listing tracks:", error.message);
    }
  }

  /**
   * Add new track to rotation
   */
  async addTrackToRotation(trackData, weekNumber = null) {
    const { error } = await this.supabase.from("library_tracks").insert({
      ...trackData,
      rotation_week: weekNumber,
    });

    if (error) throw error;
    console.log(`Added track: ${trackData.name}`);
  }

  /**
   * Add new track with interactive prompts
   */
  async addTrackInteractive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query) =>
      new Promise((resolve) => rl.question(query, resolve));

    try {
      console.log("\n=== Add New Track ===\n");

      const trackData = {
        track_id: await question("Track ID (unique identifier): "),
        name: await question("Track Name: "),
        artist: (await question("Artist (optional): ")) || null,
        genre: await question("Genre: "),
        bpm: parseInt(await question("BPM (optional): ")) || null,
        key: (await question("Key (optional): ")) || null,
        duration:
          parseInt(await question("Duration in seconds (optional): ")) || null,
        file_url: await question("File URL (path to audio file): "),
        type: await question("Type (wav/mp3): "),
        size: await question("File size (e.g., 5.5MB): "),
        tags: (await question("Tags (comma-separated): "))
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        is_pro_only:
          (await question("Pro only? (y/n): ")).toLowerCase() === "y",
        preview_url: (await question("Preview URL (optional): ")) || null,
      };

      const rotationWeek = await question(
        'Rotation week (number, or "pro" for pro-only): '
      );
      const weekNumber = rotationWeek === "pro" ? null : parseInt(rotationWeek);

      await this.addTrackToRotation(trackData, weekNumber);
      console.log("\n✅ Track added successfully!");
    } catch (error) {
      console.error("Error adding track:", error.message);
    } finally {
      rl.close();
    }
  }

  /**
   * Bulk add tracks from JSON file
   */
  async addTracksFromFile(filePath) {
    try {
      const tracksData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const tracks = Array.isArray(tracksData) ? tracksData : [tracksData];

      for (const track of tracks) {
        await this.addTrackToRotation(track, track.rotation_week);
      }

      console.log(`✅ Added ${tracks.length} tracks successfully!`);
    } catch (error) {
      console.error("Error adding tracks from file:", error.message);
    }
  }

  /**
   * Clean up old usage records
   * Note: No longer needed since we don't track individual user usage
   */
  async cleanupOldUsage() {
    console.log(
      "🧹 Cleanup not needed - we no longer track individual user library usage."
    );
    console.log(
      "The 10-track limit applies to library availability, not studio usage."
    );
  }
}

// CLI interface
async function main() {
  const manager = new TrackRotationManager();
  const command = process.argv[2];

  try {
    switch (command) {
      case "status":
        await manager.showStatus();
        break;

      case "rotate":
        await manager.rotateToNextWeek();
        break;

      case "set-week":
        const weekNumber = parseInt(process.argv[3]);
        const trackIds = process.argv.slice(4);
        if (!weekNumber || trackIds.length === 0) {
          console.log(
            "Usage: node rotate-tracks.js set-week <weekNumber> <trackId1> <trackId2> ..."
          );
          return;
        }
        await manager.setRotationWeek(trackIds, weekNumber);
        break;

      case "clear-week":
        const trackIdsToClear = process.argv.slice(3);
        if (trackIdsToClear.length === 0) {
          console.log(
            "Usage: node rotate-tracks.js clear-week <trackId1> <trackId2> ..."
          );
          return;
        }
        await manager.clearRotationWeek(trackIdsToClear);
        break;

      case "add":
        await manager.addTrackInteractive();
        break;

      case "add-file":
        const filePath = process.argv[3];
        if (!filePath) {
          console.log(
            "Usage: node rotate-tracks.js add-file <path-to-json-file>"
          );
          return;
        }
        await manager.addTracksFromFile(filePath);
        break;

      case "list":
        await manager.listAllTracks();
        break;

      case "usage":
        await manager.getUserUsageStats();
        break;

      case "cleanup":
        await manager.cleanupOldUsage();
        break;

      default:
        console.log(`
Track Rotation Manager (Updated)

Usage:
  node rotate-tracks.js status                    - Show current rotation status
  node rotate-tracks.js rotate                    - Use automated rotation (3 tracks/week)
  node rotate-tracks.js set-week <week> <ids...>  - Set rotation week for tracks
  node rotate-tracks.js clear-week <ids...>       - Clear rotation week for tracks
  node rotate-tracks.js add                       - Add new track interactively
  node rotate-tracks.js add-file <file>           - Add tracks from JSON file
  node rotate-tracks.js list                      - List all tracks with rotation info
  node rotate-tracks.js usage                     - Show user library usage statistics
  node rotate-tracks.js cleanup                   - Clean up old usage records

New Features:
  - Automated rotation with smart track selection (10 tracks for free users)
  - Rotation information display
  - Library availability management (not studio usage limits)
        `);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TrackRotationManager;
