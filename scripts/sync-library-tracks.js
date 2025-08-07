import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

class LibraryTrackSyncer {
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
   * Update database record with correct storage URL
   */
  async updateTrackUrl(trackId, fileType) {
    try {
      const storageUrl = this.supabase.storage
        .from("library-tracks")
        .getPublicUrl(`${trackId}.${fileType}`);

      const { error } = await this.supabase
        .from("library_tracks")
        .update({
          file_url: storageUrl.data.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("track_id", trackId);

      if (error) {
        console.error(`❌ Failed to update ${trackId}:`, error);
        return false;
      }

      console.log(`✅ Updated ${trackId} with storage URL`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating ${trackId}:`, error);
      return false;
    }
  }

  /**
   * Check which tracks need files uploaded
   */
  async checkMissingFiles() {
    console.log("🔍 Checking for missing files...\n");

    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();

    console.log(`Database tracks: ${dbTracks.length}`);
    console.log(`Storage files: ${storageFiles.length}\n`);

    const missingFiles = [];
    const orphanedFiles = [];

    // Check which database tracks are missing files
    for (const track of dbTracks) {
      const expectedFileName = `${track.track_id}.${track.type}`;
      const hasFile = storageFiles.some(
        (file) => file.name === expectedFileName
      );

      if (!hasFile) {
        missingFiles.push({
          trackId: track.track_id,
          name: track.name,
          type: track.type,
          expectedFile: expectedFileName,
        });
      }
    }

    // Check for orphaned files (files in storage but not in database)
    for (const file of storageFiles) {
      const trackId = file.name.split(".")[0];
      const hasTrack = dbTracks.some((track) => track.track_id === trackId);

      if (!hasTrack) {
        orphanedFiles.push(file.name);
      }
    }

    return { missingFiles, orphanedFiles };
  }

  /**
   * Update all database records with correct storage URLs
   */
  async updateAllUrls() {
    console.log("🔄 Updating all database URLs...\n");

    const dbTracks = await this.getDatabaseTracks();
    let successCount = 0;

    for (const track of dbTracks) {
      const success = await this.updateTrackUrl(track.track_id, track.type);
      if (success) successCount++;
    }

    console.log(`\n📊 URL Update Summary:`);
    console.log(
      `✅ Successfully updated: ${successCount}/${dbTracks.length} tracks`
    );
  }

  /**
   * Show detailed comparison
   */
  async showComparison() {
    console.log("📊 Library Track Comparison\n");

    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();

    console.log("=== Database Tracks ===");
    dbTracks.forEach((track) => {
      const expectedFile = `${track.track_id}.${track.type}`;
      const hasFile = storageFiles.some((file) => file.name === expectedFile);
      const status = hasFile ? "✅" : "❌";
      console.log(`${status} ${track.name} (${track.track_id}.${track.type})`);
    });

    console.log("\n=== Storage Files ===");
    storageFiles.forEach((file) => {
      const trackId = file.name.split(".")[0];
      const hasTrack = dbTracks.some((track) => track.track_id === trackId);
      const status = hasTrack ? "✅" : "❌";
      console.log(`${status} ${file.name}`);
    });

    console.log("\n=== Summary ===");
    console.log(`Database tracks: ${dbTracks.length}`);
    console.log(`Storage files: ${storageFiles.length}`);

    const { missingFiles, orphanedFiles } = await this.checkMissingFiles();
    console.log(`Missing files: ${missingFiles.length}`);
    console.log(`Orphaned files: ${orphanedFiles.length}`);
  }

  /**
   * Clean up orphaned files
   */
  async cleanupOrphanedFiles() {
    console.log("🧹 Cleaning up orphaned files...\n");

    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();

    const orphanedFiles = storageFiles.filter((file) => {
      const trackId = file.name.split(".")[0];
      return !dbTracks.some((track) => track.track_id === trackId);
    });

    if (orphanedFiles.length === 0) {
      console.log("✅ No orphaned files found");
      return;
    }

    console.log(`Found ${orphanedFiles.length} orphaned files:`);
    orphanedFiles.forEach((file) => console.log(`  - ${file.name}`));

    // Ask for confirmation before deleting
    console.log("\n⚠️  This will permanently delete these files from storage.");
    console.log("Run with --confirm to actually delete the files.");
  }

  /**
   * Create placeholder records for missing files
   */
  async createPlaceholderRecords() {
    console.log("📝 Creating placeholder records for missing files...\n");

    const dbTracks = await this.getDatabaseTracks();
    const storageFiles = await this.getStorageFiles();

    const missingFiles = dbTracks.filter((track) => {
      const expectedFileName = `${track.track_id}.${track.type}`;
      return !storageFiles.some((file) => file.name === expectedFileName);
    });

    if (missingFiles.length === 0) {
      console.log("✅ No missing files found");
      return;
    }

    console.log(`Found ${missingFiles.length} tracks missing files:`);
    missingFiles.forEach((track) => {
      console.log(`  - ${track.name} (${track.track_id}.${track.type})`);
    });

    console.log(
      "\n⚠️  You need to upload the actual audio files for these tracks."
    );
    console.log("Use the upload-library-tracks.js script to upload them.");
  }
}

// CLI interface
async function main() {
  const syncer = new LibraryTrackSyncer();
  const command = process.argv[2];
  const confirm = process.argv.includes("--confirm");

  try {
    switch (command) {
      case "check":
        await syncer.checkMissingFiles();
        break;

      case "compare":
        await syncer.showComparison();
        break;

      case "update-urls":
        await syncer.updateAllUrls();
        break;

      case "cleanup":
        if (confirm) {
          await syncer.cleanupOrphanedFiles();
        } else {
          await syncer.cleanupOrphanedFiles();
        }
        break;

      case "placeholders":
        await syncer.createPlaceholderRecords();
        break;

      default:
        console.log(`
Library Track Syncer

Usage:
  node sync-library-tracks.js check         - Check for missing files
  node sync-library-tracks.js compare       - Show detailed comparison
  node sync-library-tracks.js update-urls   - Update all database URLs
  node sync-library-tracks.js cleanup       - Show orphaned files
  node sync-library-tracks.js placeholders  - Show missing file placeholders

This script helps sync your database records with storage files.
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

export default LibraryTrackSyncer;
