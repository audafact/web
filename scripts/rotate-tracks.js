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

    // First, let's see what tracks have this rotation week (without filters)
    const { data: allTracks, error: allError } = await this.supabase
      .from("library_tracks")
      .select("track_id, name, is_active, is_pro_only, rotation_week")
      .eq("rotation_week", weekNumber);

    if (allError) throw allError;
    console.log(`All tracks with rotation_week ${weekNumber}:`, allTracks);

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
   * Set rotation week for tracks
   */
  async setRotationWeek(trackIds, weekNumber) {
    console.log(`Attempting to set week ${weekNumber} for tracks:`, trackIds);

    // First, let's check what tracks exist and their current rotation_week
    const { data: existingTracks, error: checkError } = await this.supabase
      .from("library_tracks")
      .select("track_id, name, rotation_week")
      .in("track_id", trackIds);

    if (checkError) {
      console.error("Error checking existing tracks:", checkError);
      throw checkError;
    }

    console.log("Found tracks before update:", existingTracks);

    // Try updating one track at a time to see if that works
    for (const trackId of trackIds) {
      console.log(`Updating ${trackId} to week ${weekNumber}...`);

      const { error } = await this.supabase
        .from("library_tracks")
        .update({ rotation_week: weekNumber })
        .eq("track_id", trackId);

      if (error) {
        console.error(`Error updating ${trackId}:`, error);
        throw error;
      }

      console.log(`Updated ${trackId} successfully`);
    }

    console.log(
      `Set rotation week ${weekNumber} for ${trackIds.length} tracks`
    );

    // Let's verify the update worked
    const { data: updatedTracks, error: verifyError } = await this.supabase
      .from("library_tracks")
      .select("track_id, name, rotation_week")
      .in("track_id", trackIds);

    if (verifyError) {
      console.error("Error verifying update:", verifyError);
    } else {
      console.log("Tracks after update:", updatedTracks);
    }
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
   * Rotate tracks to next week
   */
  async rotateToNextWeek() {
    const currentWeek = await this.getCurrentRotationWeek();
    const nextWeek = currentWeek + 1;

    // Get all available tracks
    const allTracks = await this.getAllTracks();

    // Select 10 tracks for next week (you can customize this logic)
    const tracksForNextWeek = this.selectTracksForWeek(allTracks, nextWeek);

    // Clear current week
    const currentWeekTracks = await this.getTracksForWeek(currentWeek);
    if (currentWeekTracks.length > 0) {
      await this.clearRotationWeek(currentWeekTracks.map((t) => t.track_id));
    }

    // Set next week
    await this.setRotationWeek(
      tracksForNextWeek.map((t) => t.track_id),
      nextWeek
    );

    console.log(`Rotated tracks: Week ${currentWeek} → Week ${nextWeek}`);
    console.log(
      `Tracks for week ${nextWeek}:`,
      tracksForNextWeek.map((t) => t.name)
    );
  }

  /**
   * Select tracks for a specific week (customize this logic)
   */
  selectTracksForWeek(allTracks, weekNumber) {
    // Simple rotation: take every 3rd track starting from week number
    const startIndex = (weekNumber - 1) * 3;
    const selectedTracks = [];

    for (let i = 0; i < 10 && startIndex + i < allTracks.length; i++) {
      selectedTracks.push(allTracks[startIndex + i]);
    }

    // If we don't have enough tracks, wrap around
    if (selectedTracks.length < 10) {
      for (let i = 0; selectedTracks.length < 10 && i < allTracks.length; i++) {
        if (!selectedTracks.find((t) => t.track_id === allTracks[i].track_id)) {
          selectedTracks.push(allTracks[i]);
        }
      }
    }

    return selectedTracks.slice(0, 10);
  }

  /**
   * Show current rotation status
   */
  async showStatus() {
    const currentWeek = await this.getCurrentRotationWeek();
    const currentTracks = await this.getTracksForWeek(currentWeek);
    const allTracks = await this.getAllTracks();

    console.log("\n=== Track Rotation Status ===");
    console.log(`Current Week: ${currentWeek}`);
    console.log(`Current Tracks (${currentTracks.length}):`);
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

      default:
        console.log(`
Track Rotation Manager

Usage:
  node rotate-tracks.js status                    - Show current rotation status
  node rotate-tracks.js rotate                    - Rotate to next week
  node rotate-tracks.js set-week <week> <ids...>  - Set rotation week for tracks
  node rotate-tracks.js clear-week <ids...>       - Clear rotation week for tracks
  node rotate-tracks.js add                       - Add new track interactively
  node rotate-tracks.js add-file <file>           - Add tracks from JSON file
  node rotate-tracks.js list                      - List all tracks with rotation info
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
