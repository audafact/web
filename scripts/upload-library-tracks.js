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

// Library tracks configuration
const LIBRARY_TRACKS = [
  {
    trackId: "ron-drums",
    name: "RON Drums",
    artist: "RON",
    genre: "drum-n-bass",
    bpm: 140,
    key: "Am",
    duration: 180,
    fileName: "RON-drums.wav",
    type: "wav",
    size: "5.5MB",
    tags: ["drums", "drum-n-bass", "electronic"],
    isProOnly: false,
    rotationWeek: 1,
  },
  {
    trackId: "secrets-of-the-heart",
    name: "Secrets of the Heart",
    artist: "Ambient Collective",
    genre: "ambient",
    bpm: 120,
    key: "Cm",
    duration: 240,
    fileName: "Secrets of the Heart.mp3",
    type: "mp3",
    size: "775KB",
    tags: ["ambient", "atmospheric", "chill"],
    isProOnly: false,
    rotationWeek: 1,
  },
  {
    trackId: "rhythm-revealed",
    name: "The Rhythm Revealed (Drums)",
    artist: "House Masters",
    genre: "house",
    bpm: 128,
    key: "Fm",
    duration: 200,
    fileName: "The Rhythm Revealed(Drums).wav",
    type: "wav",
    size: "5.5MB",
    tags: ["house", "drums", "groove"],
    isProOnly: false,
    rotationWeek: 1,
  },
  {
    trackId: "unveiled-desires",
    name: "Unveiled Desires",
    artist: "Techno Collective",
    genre: "techno",
    bpm: 135,
    key: "Em",
    duration: 220,
    fileName: "Unveiled Desires.wav",
    type: "wav",
    size: "6.0MB",
    tags: ["techno", "dark", "industrial"],
    isProOnly: false,
    rotationWeek: 1,
  },
];

class LibraryTrackUploader {
  constructor() {
    this.supabase = supabase;
    this.audioDir = path.join(process.cwd(), "src", "assets", "audio");
  }

  /**
   * Create the library-tracks bucket if it doesn't exist
   */
  async ensureBucketExists() {
    try {
      // Check if bucket exists by trying to list files
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .list("", { limit: 1 });

      if (error && error.message.includes("not found")) {
        console.log("Creating library-tracks bucket...");
        // Note: Bucket creation might require manual setup in Supabase dashboard
        console.log(
          'Please create the "library-tracks" bucket manually in your Supabase dashboard'
        );
        console.log(
          "Go to Storage → New Bucket → Name: library-tracks → Public bucket"
        );
        return false;
      }

      console.log("✅ library-tracks bucket exists");
      return true;
    } catch (error) {
      console.error("Error checking bucket:", error);
      return false;
    }
  }

  /**
   * Upload a single library track
   */
  async uploadTrack(trackConfig) {
    const filePath = path.join(this.audioDir, trackConfig.fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return false;
    }

    try {
      console.log(`📤 Uploading ${trackConfig.name}...`);

      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const file = new File([fileBuffer], trackConfig.fileName, {
        type: `audio/${trackConfig.type}`,
      });

      // Upload to storage
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .upload(`${trackConfig.trackId}.${trackConfig.type}`, file, {
          cacheControl: "3600",
          upsert: true,
          metadata: {
            trackId: trackConfig.trackId,
            name: trackConfig.name,
            artist: trackConfig.artist,
            genre: trackConfig.genre,
            bpm: trackConfig.bpm,
            key: trackConfig.key,
            duration: trackConfig.duration,
            tags: trackConfig.tags,
            originalName: trackConfig.fileName,
            size: file.size,
            type: file.type,
          },
        });

      if (error) {
        console.error(`❌ Upload failed for ${trackConfig.name}:`, error);
        return false;
      }

      console.log(`✅ Uploaded ${trackConfig.name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error uploading ${trackConfig.name}:`, error);
      return false;
    }
  }

  /**
   * Update database record with storage URL
   */
  async updateDatabaseRecord(trackConfig) {
    try {
      const storageUrl = this.supabase.storage
        .from("library-tracks")
        .getPublicUrl(`${trackConfig.trackId}.${trackConfig.type}`);

      const { error } = await this.supabase
        .from("library_tracks")
        .update({
          file_url: storageUrl.data.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("track_id", trackConfig.trackId);

      if (error) {
        console.error(
          `❌ Database update failed for ${trackConfig.name}:`,
          error
        );
        return false;
      }

      console.log(`✅ Updated database record for ${trackConfig.name}`);
      return true;
    } catch (error) {
      console.error(
        `❌ Error updating database for ${trackConfig.name}:`,
        error
      );
      return false;
    }
  }

  /**
   * Upload all library tracks
   */
  async uploadAllTracks() {
    console.log("🚀 Starting library track upload...\n");

    // Check if bucket exists
    const bucketExists = await this.ensureBucketExists();
    if (!bucketExists) {
      console.log(
        "Please create the library-tracks bucket and run this script again"
      );
      return;
    }

    let successCount = 0;
    let totalCount = LIBRARY_TRACKS.length;

    for (const trackConfig of LIBRARY_TRACKS) {
      const uploadSuccess = await this.uploadTrack(trackConfig);
      if (uploadSuccess) {
        const dbSuccess = await this.updateDatabaseRecord(trackConfig);
        if (dbSuccess) {
          successCount++;
        }
      }
      console.log(""); // Empty line for readability
    }

    console.log(`\n📊 Upload Summary:`);
    console.log(
      `✅ Successfully uploaded: ${successCount}/${totalCount} tracks`
    );

    if (successCount === totalCount) {
      console.log("🎉 All library tracks uploaded successfully!");
    } else {
      console.log("⚠️  Some tracks failed to upload. Check the errors above.");
    }
  }

  /**
   * List all uploaded tracks
   */
  async listUploadedTracks() {
    try {
      const { data, error } = await this.supabase.storage
        .from("library-tracks")
        .list("");

      if (error) {
        console.error("Error listing tracks:", error);
        return;
      }

      console.log("\n📁 Uploaded Library Tracks:");
      if (data && data.length > 0) {
        data.forEach((file) => {
          console.log(
            `  - ${file.name} (${file.metadata?.size || "Unknown size"})`
          );
        });
      } else {
        console.log("  No tracks found");
      }
    } catch (error) {
      console.error("Error listing tracks:", error);
    }
  }
}

// CLI interface
async function main() {
  const uploader = new LibraryTrackUploader();
  const command = process.argv[2];

  try {
    switch (command) {
      case "upload":
        await uploader.uploadAllTracks();
        break;

      case "list":
        await uploader.listUploadedTracks();
        break;

      default:
        console.log(`
Library Track Uploader

Usage:
  node upload-library-tracks.js upload    - Upload all library tracks to Supabase Storage
  node upload-library-tracks.js list      - List all uploaded tracks

Prerequisites:
  1. Create a "library-tracks" bucket in your Supabase dashboard
  2. Make sure audio files exist in src/assets/audio/
  3. Ensure your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
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

export default LibraryTrackUploader;
