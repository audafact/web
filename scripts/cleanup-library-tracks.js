import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

class LibraryTrackCleaner {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get all tracks from database
   */
  async getDatabaseTracks() {
    try {
      const { data, error } = await this.supabase
        .from("library_tracks")
        .select("*")
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching database tracks:", error);
      return [];
    }
  }

  /**
   * Get all files from storage
   */
  async getStorageFiles() {
    try {
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .list("");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching storage files:", error);
      return [];
    }
  }

  /**
   * Find tracks that don't have files in storage
   */
  async findTracksWithoutFiles() {
    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();

    return dbTracks.filter((track) => {
      const expectedFileName = `${track.track_id}.${track.type}`;
      return !storageFiles.some((file) => file.name === expectedFileName);
    });
  }

  /**
   * Show what will be deleted
   */
  async showCleanupPreview() {
    console.log("🧹 Library Track Cleanup Preview\n");

    const tracksToDelete = await this.findTracksWithoutFiles();
    const dbTracks = await this.getDatabaseTracks();

    console.log(`Total database tracks: ${dbTracks.length}`);
    console.log(`Tracks to delete: ${tracksToDelete.length}`);
    console.log(`Tracks to keep: ${dbTracks.length - tracksToDelete.length}\n`);

    if (tracksToDelete.length > 0) {
      console.log("Tracks that will be deleted:");
      tracksToDelete.forEach((track) => {
        console.log(`  ❌ ${track.name} (${track.track_id}.${track.type})`);
      });
    }

    const storageFiles = await this.getStorageFiles();
    const tracksToKeep = dbTracks.filter((track) => {
      const expectedFileName = `${track.track_id}.${track.type}`;
      return storageFiles.some((file) => file.name === expectedFileName);
    });

    console.log("\nTracks that will be kept:");
    tracksToKeep.forEach((track) => {
      console.log(`  ✅ ${track.name} (${track.track_id}.${track.type})`);
    });
  }

  /**
   * Delete tracks that don't have files
   */
  async cleanupTracks() {
    console.log("🧹 Cleaning up tracks without files...\n");

    const tracksToDelete = await this.findTracksWithoutFiles();

    if (tracksToDelete.length === 0) {
      console.log("✅ No tracks to delete");
      return;
    }

    console.log(`Found ${tracksToDelete.length} tracks to delete:`);
    tracksToDelete.forEach((track) => {
      console.log(`  - ${track.name} (${track.track_id})`);
    });

    console.log(
      "\n⚠️  This will permanently delete these tracks from the database."
    );
    console.log("Run with --confirm to actually delete the tracks.");

    if (process.argv.includes("--confirm")) {
      console.log("\n🗑️  Deleting tracks...");

      let successCount = 0;
      for (const track of tracksToDelete) {
        try {
          const { error } = await this.supabase
            .from("library_tracks")
            .delete()
            .eq("track_id", track.track_id);

          if (error) {
            console.error(`❌ Failed to delete ${track.name}:`, error);
          } else {
            console.log(`✅ Deleted ${track.name}`);
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error deleting ${track.name}:`, error);
        }
      }

      console.log(`\n📊 Cleanup Summary:`);
      console.log(
        `✅ Successfully deleted: ${successCount}/${tracksToDelete.length} tracks`
      );
    }
  }

  /**
   * Reset rotation weeks for remaining tracks
   */
  async resetRotationWeeks() {
    console.log("🔄 Resetting rotation weeks...\n");

    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();
    const tracksWithFiles = dbTracks.filter((track) => {
      const expectedFileName = `${track.track_id}.${track.type}`;
      return storageFiles.some((file) => file.name === expectedFileName);
    });

    console.log(
      `Resetting rotation weeks for ${tracksWithFiles.length} tracks...`
    );

    for (const track of tracksWithFiles) {
      try {
        const { error } = await this.supabase
          .from("library_tracks")
          .update({
            rotation_week: 1, // Set all tracks to week 1
            updated_at: new Date().toISOString(),
          })
          .eq("track_id", track.track_id);

        if (error) {
          console.error(`❌ Failed to update ${track.name}:`, error);
        } else {
          console.log(`✅ Reset rotation week for ${track.name}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${track.name}:`, error);
      }
    }

    console.log("\n✅ Rotation weeks reset complete");
  }

  /**
   * Update file URLs for remaining tracks
   */
  async updateFileUrls() {
    console.log("🔗 Updating file URLs...\n");

    const dbTracks = await this.getDatabaseTracks();
    let successCount = 0;

    for (const track of dbTracks) {
      try {
        const storageUrl = this.supabase.storage
          .from("library-tracks")
          .getPublicUrl(`${track.track_id}.${track.type}`);

        const { error } = await this.supabase
          .from("library_tracks")
          .update({
            file_url: storageUrl.data.publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("track_id", track.track_id);

        if (error) {
          console.error(`❌ Failed to update ${track.name}:`, error);
        } else {
          console.log(`✅ Updated URL for ${track.name}`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${track.name}:`, error);
      }
    }

    console.log(`\n📊 URL Update Summary:`);
    console.log(
      `✅ Successfully updated: ${successCount}/${dbTracks.length} tracks`
    );
  }
}

// CLI interface
async function main() {
  const cleaner = new LibraryTrackCleaner();
  const command = process.argv[2];

  try {
    switch (command) {
      case "preview":
        await cleaner.showCleanupPreview();
        break;

      case "cleanup":
        await cleaner.cleanupTracks();
        break;

      case "reset-rotation":
        await cleaner.resetRotationWeeks();
        break;

      case "update-urls":
        await cleaner.updateFileUrls();
        break;

      case "full-cleanup":
        console.log("🧹 Performing full cleanup...\n");
        await cleaner.cleanupTracks();
        await cleaner.resetRotationWeeks();
        await cleaner.updateFileUrls();
        break;

      default:
        console.log(`
Library Track Cleaner

Usage:
  node cleanup-library-tracks.js preview        - Show what will be cleaned up
  node cleanup-library-tracks.js cleanup        - Delete tracks without files (use --confirm)
  node cleanup-library-tracks.js reset-rotation - Reset rotation weeks to 1
  node cleanup-library-tracks.js update-urls    - Update file URLs for remaining tracks
  node cleanup-library-tracks.js full-cleanup   - Run all cleanup operations

This script removes database records for tracks that don't have files in storage.
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

export default LibraryTrackCleaner;
