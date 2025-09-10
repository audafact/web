import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

const WORKER_URL = "https://audafact-api.david-g-cortinas.workers.dev";

// Load JWT token from a separate file to avoid environment variable issues
function loadJWTToken() {
  try {
    // Try to load from .env first
    if (process.env.TEST_JWT_TOKEN) {
      return process.env.TEST_JWT_TOKEN;
    }

    // Try to load from a separate token file
    const tokenFile = path.join(process.cwd(), "jwt-token.txt");
    if (fs.existsSync(tokenFile)) {
      return fs.readFileSync(tokenFile, "utf8").trim();
    }

    // Try to get token from the app's session (if running in browser)
    if (typeof window !== "undefined" && window.supabase) {
      // This will only work if running in the browser
      console.log("🌐 Running in browser - attempting to get JWT from session");
      return null; // We'll handle this differently
    }

    console.error(
      "❌ No JWT token found. Please set TEST_JWT_TOKEN in .env or create jwt-token.txt"
    );
    return null;
  } catch (error) {
    console.error("Error loading JWT token:", error);
    return null;
  }
}

class TestR2Migration {
  constructor() {
    this.supabase = supabase;
    this.workerUrl = WORKER_URL;
    this.tempDir = path.join(process.cwd(), "temp-migration");
  }

  /**
   * Ensure temp directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get 2-3 tracks for testing
   */
  async getTestTracks() {
    try {
      const { data, error } = await this.supabase
        .from("library_tracks")
        .select("*")
        .limit(3);

      if (error) {
        console.error("Error fetching test tracks:", error);
        return [];
      }

      console.log(`\n📁 Found ${data.length} test tracks:`);
      data.forEach((track, index) => {
        console.log(`  ${index + 1}. ${track.name} (${track.file_url})`);
      });

      return data;
    } catch (error) {
      console.error("Error fetching test tracks:", error);
      return [];
    }
  }

  /**
   * Download track from Supabase storage
   */
  async downloadTrack(track) {
    try {
      console.log(`\n📥 Downloading ${track.name}...`);

      // Extract filename from URL
      const urlParts = track.file_url.split("/");
      const filename = urlParts[urlParts.length - 1];
      const localPath = path.join(this.tempDir, filename);

      // Download file
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .download(filename);

      if (error) {
        console.error(`❌ Download failed for ${track.name}:`, error);
        return null;
      }

      // Save to temp directory
      const buffer = await data.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(buffer));

      console.log(`✅ Downloaded ${track.name} to ${localPath}`);
      return { localPath, filename };
    } catch (error) {
      console.error(`❌ Error downloading ${track.name}:`, error);
      return null;
    }
  }

  /**
   * Get presigned upload URL from Worker API
   */
  async getPresignedUrl(track, filename, localPath) {
    try {
      console.log(`🔑 Getting presigned URL for ${track.name}...`);

      const jwtToken = loadJWTToken();
      if (!jwtToken) {
        console.error("❌ No JWT token available");
        return null;
      }

      const response = await fetch(`${this.workerUrl}/api/sign-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          filename: filename,
          contentType: `audio/${track.type}`,
          sizeBytes: fs.statSync(localPath).size,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to get presigned URL:`, errorText);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Got presigned URL for ${track.name}`);
      return data;
    } catch (error) {
      console.error(`❌ Error getting presigned URL for ${track.name}:`, error);
      return null;
    }
  }

  /**
   * Upload track to R2 using presigned URL
   */
  async uploadToR2(track, presignedData) {
    try {
      console.log(`📤 Uploading ${track.name} to R2...`);

      const fileBuffer = fs.readFileSync(track.localPath);

      const response = await fetch(presignedData.uploadUrl, {
        method: "PUT",
        body: fileBuffer,
        headers: {
          "Content-Type": `audio/${track.type}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ R2 upload failed for ${track.name}:`, errorText);
        return null;
      }

      console.log(`✅ Uploaded ${track.name} to R2`);
      return presignedData.key;
    } catch (error) {
      console.error(`❌ Error uploading ${track.name} to R2:`, error);
      return null;
    }
  }

  /**
   * Update database with R2 URL
   */
  async updateDatabase(track, r2Key) {
    try {
      console.log(`🔄 Updating database for ${track.name}...`);

      // Construct R2 URL (you'll need to adjust this based on your R2 setup)
      const r2Url = `${this.workerUrl}/api/stream?key=${r2Key}`;

      const { error } = await this.supabase
        .from("library_tracks")
        .update({
          file_url: r2Url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", track.id);

      if (error) {
        console.error(`❌ Database update failed for ${track.name}:`, error);
        return false;
      }

      console.log(`✅ Updated database for ${track.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating database for ${track.name}:`, error);
      return false;
    }
  }

  /**
   * Clean up temp files
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temp directory: ${this.tempDir}`);
      }
    } catch (error) {
      console.error("Error cleaning up:", error);
    }
  }

  /**
   * Run test migration for 2-3 tracks
   */
  async runTestMigration() {
    console.log("🧪 Starting Test R2 Migration...\n");

    try {
      // Ensure temp directory exists
      this.ensureTempDir();

      // Get test tracks
      const testTracks = await this.getTestTracks();
      if (testTracks.length === 0) {
        console.log("❌ No test tracks found");
        return;
      }

      let successCount = 0;
      const totalCount = testTracks.length;

      for (const track of testTracks) {
        try {
          console.log(`\n🔄 Processing track: ${track.name}`);

          // Download from Supabase
          const downloadResult = await this.downloadTrack(track);
          if (!downloadResult) continue;

          // Get presigned URL
          const presignedData = await this.getPresignedUrl(
            track,
            downloadResult.filename,
            downloadResult.localPath
          );
          if (!presignedData) continue;

          // Upload to R2
          const r2Key = await this.uploadToR2(track, presignedData);
          if (!r2Key) continue;

          // Update database
          const dbUpdated = await this.updateDatabase(track, r2Key);
          if (dbUpdated) {
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing ${track.name}:`, error);
        }
      }

      console.log(`\n📊 Test Migration Summary:`);
      console.log(
        `✅ Successfully migrated: ${successCount}/${totalCount} tracks`
      );

      if (successCount === totalCount) {
        console.log(
          "🎉 Test migration successful! Ready to migrate all tracks."
        );
      } else {
        console.log("⚠️  Some tracks failed. Check the errors above.");
      }
    } catch (error) {
      console.error("❌ Test migration failed:", error);
    } finally {
      // Clean up temp files
      this.cleanup();
    }
  }
}

// CLI interface
async function main() {
  const migration = new TestR2Migration();
  const command = process.argv[2];

  try {
    switch (command) {
      case "test":
        await migration.runTestMigration();
        break;

      default:
        console.log(`
Test R2 Migration Tool

Usage:
  node test-r2-migration.js test    - Run test migration for 2-3 tracks

Prerequisites:
  1. Ensure your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
  2. Set TEST_JWT_TOKEN in your .env for Worker API authentication
  3. Make sure your Worker API is running and accessible
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

export default TestR2Migration;
