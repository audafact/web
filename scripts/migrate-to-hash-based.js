import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load from both .env (Supabase) and .env.ingest (R2)
dotenv.config(); // Load .env first
dotenv.config({ path: ".env.ingest" }); // Then load .env.ingest

class HashBasedMigration {
  constructor() {
    console.log("🔧 Environment check:");
    console.log(
      "   VITE_SUPABASE_URL:",
      process.env.VITE_SUPABASE_URL ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "   VITE_SUPABASE_ANON_KEY:",
      process.env.VITE_SUPABASE_ANON_KEY ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "   R2_ACCESS_KEY_ID:",
      process.env.R2_ACCESS_KEY_ID ? "✅ Set" : "❌ Missing"
    );
    console.log(
      "   R2_BUCKET:",
      process.env.R2_BUCKET ? "✅ Set" : "❌ Missing"
    );
    console.log("");

    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY
    );

    this.r2Client = new S3Client({
      region: "auto",
      endpoint:
        process.env.R2_ENDPOINT ||
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    this.r2Bucket = process.env.R2_BUCKET || "audafact";
    this.tempDir = path.join(process.cwd(), "temp-migration");
  }

  /**
   * Create temporary directory for processing files
   */
  async setupTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log("📁 Created temp directory:", this.tempDir);
    }
  }

  /**
   * Clean up temporary directory
   */
  async cleanupTempDir() {
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      console.log("🧹 Cleaned up temp directory");
    }
  }

  /**
   * List all tracks in Supabase storage
   */
  async listStorageTracks() {
    try {
      console.log("🔍 Attempting to list storage tracks...");
      console.log("   Storage bucket: library-tracks");
      console.log("   Supabase URL:", process.env.VITE_SUPABASE_URL);

      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .list("");

      if (error) {
        console.error("❌ Error listing storage tracks:", error);
        return [];
      }

      console.log(`📁 Found ${data?.length || 0} tracks in Supabase storage`);
      if (data && data.length > 0) {
        data.slice(0, 5).forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name}`);
        });
        if (data.length > 5) {
          console.log(`   ... and ${data.length - 5} more`);
        }
      }

      return data || [];
    } catch (error) {
      console.error("❌ Error listing storage tracks:", error);
      return [];
    }
  }

  /**
   * Download a file from Supabase storage
   */
  async downloadTrack(filename) {
    try {
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .download(filename);

      if (error) {
        console.error(`❌ Error downloading ${filename}:`, error);
        return null;
      }

      const localPath = path.join(this.tempDir, filename);
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      fs.writeFileSync(localPath, buffer);
      console.log(`⬇️  Downloaded: ${filename}`);

      return {
        localPath,
        size: buffer.length,
        filename,
      };
    } catch (error) {
      console.error(`❌ Error downloading ${filename}:`, error);
      return null;
    }
  }

  /**
   * Compute SHA-256 hash of a file
   */
  async computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Generate hash-based key for library track
   */
  generateLibraryKey(trackId, shortHash, ext) {
    return `library/originals/${trackId}-${shortHash}.${ext}`;
  }

  /**
   * Create kebab-case track ID from filename
   */
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Upload file to R2 with hash-based key
   */
  async uploadToR2(key, localPath, contentType) {
    try {
      const fileStream = fs.createReadStream(localPath);

      await this.r2Client.send(
        new PutObjectCommand({
          Bucket: this.r2Bucket,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
        })
      );

      console.log(`⬆️  Uploaded to R2: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Error uploading ${key}:`, error);
      return false;
    }
  }

  /**
   * Update database record with new file_key
   */
  async updateDatabaseRecord(
    trackId,
    newFileKey,
    contentHash,
    sizeBytes,
    contentType
  ) {
    try {
      const { error } = await this.supabase
        .from("library_tracks")
        .update({
          file_key: newFileKey,
          content_hash: contentHash,
          size_bytes: sizeBytes,
          content_type: contentType,
        })
        .eq("track_id", trackId);

      if (error) {
        console.error(`❌ Error updating database for ${trackId}:`, error);
        return false;
      }

      console.log(`💾 Updated database: ${trackId} -> ${newFileKey}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating database for ${trackId}:`, error);
      return false;
    }
  }

  /**
   * Process a single track
   */
  async processTrack(storageFile) {
    const filename = storageFile.name;
    const ext = filename.split(".").pop().toLowerCase();
    const baseName = filename.replace(/\.[^/.]+$/, "");

    // Generate track ID from filename
    const trackId = this.slugify(baseName);

    console.log(`\n🔄 Processing: ${filename}`);
    console.log(`   Track ID: ${trackId}`);

    // Download from Supabase
    const downloadResult = await this.downloadTrack(filename);
    if (!downloadResult) return false;

    // Compute hash
    const fullHash = await this.computeFileHash(downloadResult.localPath);
    const shortHash = fullHash.slice(0, 10);

    console.log(`   Hash: ${shortHash}`);

    // Generate new key
    const newKey = this.generateLibraryKey(trackId, shortHash, ext);
    console.log(`   New Key: ${newKey}`);

    // Upload to R2
    const contentType = ext === "wav" ? "audio/wav" : "audio/mpeg";
    const uploadSuccess = await this.uploadToR2(
      newKey,
      downloadResult.localPath,
      contentType
    );
    if (!uploadSuccess) return false;

    // Update database
    const updateSuccess = await this.updateDatabaseRecord(
      trackId,
      newKey,
      fullHash,
      downloadResult.size,
      contentType
    );

    // Clean up local file
    fs.unlinkSync(downloadResult.localPath);

    return updateSuccess;
  }

  /**
   * Run the complete migration
   */
  async migrate(testMode = false) {
    console.log("🚀 Starting Hash-Based Migration...\n");
    if (testMode) {
      console.log("🧪 TEST MODE: Only processing first 3 tracks\n");
    }

    try {
      await this.setupTempDir();

      // Get all tracks from storage
      const storageTracks = await this.listStorageTracks();
      if (storageTracks.length === 0) {
        console.log("❌ No tracks found in storage");
        return;
      }

      // Limit tracks in test mode
      const tracksToProcess = testMode
        ? storageTracks.slice(0, 3)
        : storageTracks;
      console.log(
        `📊 Processing ${tracksToProcess.length} tracks${
          testMode ? " (test mode)" : ""
        }`
      );

      let successCount = 0;
      const totalCount = tracksToProcess.length;

      // Process each track
      for (const track of tracksToProcess) {
        const success = await this.processTrack(track);
        if (success) successCount++;
      }

      console.log(`\n✅ Migration Complete!`);
      console.log(`   Success: ${successCount}/${totalCount}`);
      console.log(`   Failed: ${totalCount - successCount}`);

      if (testMode && successCount > 0) {
        console.log(`\n🎉 Test successful! Ready to run full migration.`);
        console.log(
          `   Run without --test to migrate all ${storageTracks.length} tracks.`
        );
      }
    } catch (error) {
      console.error("❌ Migration failed:", error);
    } finally {
      await this.cleanupTempDir();
    }
  }
}

// CLI interface
async function main() {
  const migration = new HashBasedMigration();

  if (process.argv.includes("--help")) {
    console.log(`
Hash-Based Migration Script

Usage:
  node scripts/migrate-to-hash-based.js [--test]

Options:
  --test    Test mode: only process first 3 tracks

Environment Variables Required:
  SUPABASE_URL - Your Supabase project URL
  VITE_SUPABASE_ANON_KEY - Your Supabase anon key
  R2_ACCESS_KEY_ID - Your R2 access key ID
  R2_SECRET_ACCESS_KEY - Your R2 secret access key
  R2_ACCOUNT_ID - Your R2 account ID
  R2_BUCKET - Your R2 bucket name (default: audafact)

This script will:
1. Download all tracks from Supabase storage
2. Compute SHA-256 hashes
3. Generate new hash-based keys (library/originals/{trackId}-{hash}.{ext})
4. Upload to R2 with new keys
5. Update database records with new file_key values
    `);
    return;
  }

  const testMode = process.argv.includes("--test");
  await migration.migrate(testMode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
