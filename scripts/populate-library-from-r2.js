#!/usr/bin/env node

/**
 * Script to populate library_tracks table from R2 bucket and CSV data
 *
 * This script:
 * 1. Reads R2 bucket contents from audafact/library/originals
 * 2. Parses track names and short hashes
 * 3. Matches tracks to CSV genre/tag data
 * 4. Generates content hashes for each file
 * 5. Populates the library_tracks table
 */

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

// Configuration
const R2_BUCKET = "audafact";
const R2_PREFIX = "library/originals";
const CSV_FILE = "./audafact-track-genre-and-tags - Sheet1.csv";

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * Parse R2 file entries to extract track info
 */
async function getR2Tracks() {
  console.log("🔍 Scanning R2 bucket for tracks...");

  const tracks = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: R2_PREFIX,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    for (const object of response.Contents || []) {
      if (object.Key && object.Key.endsWith(".mp3")) {
        const trackInfo = parseR2Key(object.Key);
        if (trackInfo) {
          tracks.push({
            ...trackInfo,
            size: object.Size,
            lastModified: object.LastModified,
          });
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`📁 Found ${tracks.length} tracks in R2`);
  return tracks;
}

/**
 * Parse R2 key to extract track info
 * Format: library/originals/song-name-version-1-<short_hash>.mp3
 */
function parseR2Key(key) {
  // Remove prefix and extension
  const filename = key.replace(`${R2_PREFIX}/`, "").replace(".mp3", "");

  // Find the last dash followed by hash (hash is typically 8-12 characters)
  const hashMatch = filename.match(/-([a-f0-9]{8,12})$/);
  if (!hashMatch) {
    console.warn(`⚠️  Could not parse hash from key: ${key}`);
    return null;
  }

  const shortHash = hashMatch[1];
  const trackNamePart = filename.replace(`-${shortHash}`, "");

  // Check if this is a versioned track
  const versionMatch = trackNamePart.match(/-version-(\d+)$/);
  let trackId, version;

  if (versionMatch) {
    version = parseInt(versionMatch[1]);
    trackId = trackNamePart.replace(`-version-${version}`, "");
  } else {
    trackId = trackNamePart;
    version = 1;
  }

  return {
    key,
    trackId,
    version,
    shortHash,
    fullName: trackNamePart,
  };
}

/**
 * Load and parse CSV data
 */
function loadCSVData() {
  console.log("📊 Loading CSV data...");

  const csvContent = readFileSync(CSV_FILE, "utf-8");
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📋 Loaded ${records.length} tracks from CSV`);
  return records;
}

/**
 * Match R2 tracks to CSV data using fuzzy matching
 */
function matchTracksToCSV(r2Tracks, csvTracks) {
  console.log("🔗 Matching R2 tracks to CSV data...");

  const matchedTracks = [];
  const csvMatchCounts = {};

  for (const r2Track of r2Tracks) {
    // Find the best match in CSV data
    const bestMatch = findBestCSVMatch(r2Track.trackId, csvTracks);

    if (bestMatch) {
      // Track how many R2 versions match each CSV entry
      const csvKey = bestMatch.Track;
      csvMatchCounts[csvKey] = (csvMatchCounts[csvKey] || 0) + 1;

      matchedTracks.push({
        ...r2Track,
        csvData: bestMatch,
      });
    } else {
      console.warn(`⚠️  No CSV match found for: ${r2Track.trackId}`);
      // Create entry with default values
      matchedTracks.push({
        ...r2Track,
        csvData: {
          Track: r2Track.trackId,
          Genre: "unknown",
          Tags: "",
        },
      });
    }
  }

  // Log CSV match statistics
  console.log("\n📊 CSV Match Statistics:");
  for (const [csvTrack, count] of Object.entries(csvMatchCounts)) {
    console.log(`  "${csvTrack}": ${count} R2 version(s)`);
  }
  console.log("");

  return matchedTracks;
}

/**
 * Find best CSV match using fuzzy string matching
 */
function findBestCSVMatch(r2TrackId, csvTracks) {
  let bestMatch = null;
  let bestScore = 0;

  for (const csvTrack of csvTracks) {
    const csvName = csvTrack.Track.toLowerCase();
    const r2Name = r2TrackId.toLowerCase();

    // Calculate similarity score
    const score = calculateSimilarity(csvName, r2Name);

    if (score > bestScore && score > 0.7) {
      // 70% similarity threshold
      bestScore = score;
      bestMatch = csvTrack;
    }
  }

  return bestMatch;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[str2.length][str1.length];
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

/**
 * Generate content hash for a file
 */
async function generateContentHash(key) {
  try {
    console.log(`🔐 Generating hash for: ${key}`);

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];

    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const hash = createHash("sha256").update(buffer).digest("hex");

    return hash;
  } catch (error) {
    console.error(`❌ Error generating hash for ${key}:`, error.message);
    return null;
  }
}

/**
 * Insert tracks into database
 */
async function insertTracksToDatabase(matchedTracks) {
  console.log("💾 Inserting tracks into database...");

  const tracksToInsert = [];

  for (const track of matchedTracks) {
    // Parse genre and tags
    const genres = track.csvData.Genre.split(",").map((g) => g.trim());
    const tags = track.csvData.Tags.split(",").map((t) => t.trim());

    // Generate file keys
    const fileKey = track.key;
    const previewKey = track.key
      .replace("/originals/", "/previews/")
      .replace(".mp3", "-preview.mp3");

    tracksToInsert.push({
      track_id: `${track.trackId}-${track.shortHash}`,
      name: track.csvData.Track,
      artist: null, // Could be extracted from CSV if available
      genre: genres,
      bpm: null, // Could be extracted from audio metadata if needed
      key: null,
      duration: null,
      type: "mp3",
      size: formatFileSize(track.size),
      tags: tags,
      is_pro_only: false, // Default to free, can be updated later
      is_active: true,
      rotation_week: null, // Can be set later for rotation

      // New R2 fields
      file_key: fileKey,
      preview_key: previewKey,
      short_hash: track.shortHash,
      content_hash: null, // Will be populated after hash generation
      size_bytes: track.size,
      content_type: "audio/mpeg",
    });
  }

  // Insert in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < tracksToInsert.length; i += batchSize) {
    const batch = tracksToInsert.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from("library_tracks")
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error);
    } else {
      console.log(
        `✅ Inserted batch ${i / batchSize + 1}: ${batch.length} tracks`
      );
    }
  }

  return tracksToInsert.length;
}

/**
 * Update content hashes for all tracks
 */
async function updateContentHashes() {
  console.log("🔐 Updating content hashes...");

  const { data: tracks, error } = await supabase
    .from("library_tracks")
    .select("id, file_key, short_hash")
    .is("content_hash", null);

  if (error) {
    console.error("❌ Error fetching tracks for hash update:", error);
    return;
  }

  console.log(`🔐 Updating hashes for ${tracks.length} tracks...`);

  for (const track of tracks) {
    const hash = await generateContentHash(track.file_key);

    if (hash) {
      const { error: updateError } = await supabase
        .from("library_tracks")
        .update({ content_hash: hash })
        .eq("id", track.id);

      if (updateError) {
        console.error(
          `❌ Error updating hash for ${track.file_key}:`,
          updateError
        );
      } else {
        console.log(`✅ Updated hash for: ${track.file_key}`);
      }
    }

    // Small delay to avoid overwhelming R2
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("🚀 Starting library population from R2...");

    // Check environment variables
    const requiredEnvVars = [
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
    }

    // Step 1: Get R2 tracks
    const r2Tracks = await getR2Tracks();

    // Step 2: Load CSV data
    const csvTracks = loadCSVData();

    // Step 3: Match tracks
    const matchedTracks = matchTracksToCSV(r2Tracks, csvTracks);

    // Step 4: Insert into database
    const insertedCount = await insertTracksToDatabase(matchedTracks);

    console.log(`✅ Successfully inserted ${insertedCount} tracks`);

    // Step 5: Update content hashes (optional, can be run separately)
    console.log("🔐 Starting content hash generation...");
    await updateContentHashes();

    console.log("🎉 Library population complete!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, getR2Tracks, parseR2Key, matchTracksToCSV };
