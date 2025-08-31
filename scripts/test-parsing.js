#!/usr/bin/env node

/**
 * Test script to verify R2 key parsing logic
 * Run this to test the parsing without connecting to R2 or Supabase
 */

// Test cases with valid hexadecimal hashes
const testKeys = [
  "library/originals/this-loves-a-serenade-a1b2c3d4.mp3",
  "library/originals/this-loves-a-serenade-version-1-a1b2c3d4.mp3",
  "library/originals/this-loves-a-serenade-version-2-a1b2c3d4.mp3",
  "library/originals/break-the-chains-b5c6d7e8.mp3",
  "library/originals/dancing-thrilling-version-1-f9a0b1c2.mp3",
  "library/originals/groove-on-the-beat-j3k4l5m6.mp3",
  "library/originals/hot-honey-dripping-n7a8b9c0.mp3",
];

/**
 * Parse R2 key to extract track info
 * Format: library/originals/song-name-version-1-<short_hash>.mp3
 */
function parseR2Key(key) {
  const R2_PREFIX = "library/originals";

  // Remove prefix and extension
  const filename = key.replace(`${R2_PREFIX}/`, "").replace(".mp3", "");

  // Find the last dash followed by hash (hash is typically 8-12 characters)
  // Updated regex to be more flexible with hash detection
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

console.log("🧪 Testing R2 key parsing logic...\n");

for (const key of testKeys) {
  const result = parseR2Key(key);
  if (result) {
    console.log(`Input:  ${key}`);
    console.log(`Output: ${JSON.stringify(result, null, 2)}`);
  } else {
    console.log(`Input:  ${key}`);
    console.log(`Output: ❌ Failed to parse`);
  }
  console.log("---");
}

// Test CSV matching logic
console.log("\n🔗 Testing CSV matching logic...\n");

const csvTracks = [
  {
    Track: "This Love's a Serenade",
    Genre: "jazz, soul",
    Tags: "female vocalist, jazz, soul jazz, lush, passionate, melodic, soulful",
  },
  {
    Track: "Break the Chains",
    Genre: "r&b, orchestral, soul",
    Tags: "female vocalist, r&b, uplifting, conscious, anthemic, orchestral, soul",
  },
  {
    Track: "Dancing Thrilling",
    Genre: "disco, r&b, soul, funk",
    Tags: "dance, disco, r&b, soul, smooth soul, funk, 80s, soulful",
  },
  {
    Track: "Groove on the Beat",
    Genre: "edm, house",
    Tags: "male vocalist, electronic, electronic dance music, breakbeat, house, funky house, party, energetic, sampling, summer, uplifting, happy, soulful, instrumental",
  },
  {
    Track: "Hot Honey Dripping",
    Genre: "r&b, funk, edm, disco",
    Tags: "male vocalist, r&b, funk, electronic, edm, rhythmic, dance-pop, dance, melodic, party, passionate, lush, love, disco, breakup, energetic, bittersweet",
  },
];

const r2TrackIds = [
  "this-loves-a-serenade",
  "break-the-chains",
  "dancing-thrilling",
  "groove-on-the-beat",
  "hot-honey-dripping",
];

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

function findBestCSVMatch(r2TrackId, csvTracks) {
  let bestMatch = null;
  let bestScore = 0;

  for (const csvTrack of csvTracks) {
    const csvName = csvTrack.Track.toLowerCase();
    const r2Name = r2TrackId.toLowerCase();

    const score = calculateSimilarity(csvName, r2Name);

    if (score > bestScore && score > 0.7) {
      bestScore = score;
      bestMatch = csvTrack;
    }
  }

  return { match: bestMatch, score: bestScore };
}

for (const r2TrackId of r2TrackIds) {
  const result = findBestCSVMatch(r2TrackId, csvTracks);
  console.log(`R2 Track ID: ${r2TrackId}`);
  console.log(`Best CSV Match: ${result.match?.Track || "None"}`);
  console.log(`Similarity Score: ${result.score.toFixed(3)}`);
  console.log("---");
}

console.log("\n✅ Parsing tests complete!");
