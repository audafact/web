# Complete Solution: Populate Library Tracks from R2

## Overview

This solution provides a complete workflow to populate your `library_tracks` table in Supabase with data from your R2 bucket and CSV file. It handles the complex task of matching R2 filenames to CSV entries and generates all necessary metadata including content hashes.

## What We've Built

### 1. Database Migration

- **File**: `web/supabase/migrations/20250830201700_add_r2_storage_fields.sql`
- **Purpose**: Adds R2 storage fields to your existing `library_tracks` table
- **Fields Added**:
  - `file_key` - R2 storage key for main audio files
  - `preview_key` - R2 storage key for preview files
  - `short_hash` - Short hash identifier
  - `content_hash` - SHA-256 content hash
  - `size_bytes` - File size in bytes
  - `content_type` - MIME type

### 2. Main Population Script

- **File**: `web/scripts/populate-library-from-r2.js`
- **Purpose**: Orchestrates the entire population process
- **Features**:
  - Scans R2 bucket for all MP3 files
  - Parses track names and short hashes
  - Matches tracks to CSV data using fuzzy string matching
  - Generates content hashes by downloading files
  - Populates database with proper metadata
  - Handles versioned tracks (e.g., `song-name-version-1-hash.mp3`)

### 3. Test Script

- **File**: `web/scripts/test-parsing.js`
- **Purpose**: Tests parsing logic without connecting to external services
- **Use Case**: Verify the logic works before running the full script

### 4. Setup Script

- **File**: `web/scripts/setup.sh`
- **Purpose**: Automates initial setup and dependency installation

## How It Solves Your Requirements

### ✅ R2 File Parsing

- **Input**: `library/originals/song-name-version-1-a1b2c3d4.mp3`
- **Output**:
  - `trackId`: `song-name`
  - `version`: `1`
  - `shortHash`: `a1b2c3d4`

### ✅ CSV Matching

- **R2**: `this-loves-a-serenade-version-1-a1b2c3d4`
- **CSV**: `This Love's a Serenade`
- **Result**: ✅ High similarity match (handles spaces vs dashes)

### ✅ Versioned Track Handling

- Multiple versions of the same track get identical genre/tag data
- Each version gets a unique `track_id` (e.g., `song-name-a1b2c3d4`)
- Shared metadata (name, genre, tags) across versions

### ✅ Content Hash Generation

- Downloads each file from R2
- Generates SHA-256 hash for deduplication
- Stores hash in database for integrity checking

### ✅ File Key Generation

- `file_key`: `library/originals/song-name-version-1-a1b2c3d4.mp3`
- `preview_key`: `library/previews/song-name-version-1-a1b2c3d4-preview.mp3`

## Implementation Steps

### Step 1: Run Database Migration

```bash
cd web
supabase db push
```

### Step 2: Setup Script Environment

```bash
cd scripts
./setup.sh
```

### Step 3: Configure Environment Variables

Edit `.env` file with your actual credentials:

- Supabase URL and service role key
- R2 account ID and access keys

### Step 4: Test Parsing Logic

```bash
node test-parsing.js
```

### Step 5: Run Full Population

```bash
npm start
```

## Example Output

For a track like `this-loves-a-serenade-version-1-a1b2c3d4.mp3`:

```json
{
  "track_id": "this-loves-a-serenade-a1b2c3d4",
  "name": "This Love's a Serenade",
  "genre": ["jazz", "soul"],
  "tags": [
    "female vocalist",
    "jazz",
    "soul jazz",
    "lush",
    "passionate",
    "melodic",
    "soulful"
  ],
  "file_key": "library/originals/this-loves-a-serenade-version-1-a1b2c3d4.mp3",
  "preview_key": "library/previews/this-loves-a-serenade-version-1-a1b2c3d4-preview.mp3",
  "short_hash": "a1b2c3d4",
  "content_hash": "generated-sha256-hash",
  "size_bytes": 12345678,
  "content_type": "audio/mpeg"
}
```

## Key Features

### 🔍 Smart Parsing

- Handles complex filenames with versions
- Extracts short hashes reliably
- Supports various naming conventions

### 🔗 Fuzzy Matching

- Uses Levenshtein distance for CSV matching
- Handles differences in spacing and punctuation
- Configurable similarity threshold (70% default)

### 🔐 Content Hashing

- Generates SHA-256 hashes for all files
- Downloads files in chunks to manage memory
- Includes rate limiting to avoid overwhelming R2

### 💾 Database Integration

- Batch insertion for performance
- Proper error handling and logging
- Maintains data integrity

### 📊 Metadata Enrichment

- Parses CSV genre and tag arrays
- Generates proper file keys
- Sets appropriate content types

## Performance Considerations

- **Hash Generation**: Downloads each file (can be slow for large libraries)
- **Batch Processing**: Inserts tracks in groups of 10
- **Rate Limiting**: Includes delays to avoid overwhelming R2
- **Memory Management**: Streams files to avoid loading entire files into memory

## Troubleshooting

### Common Issues

1. **Environment variables not set** - Check your `.env` file
2. **R2 access denied** - Verify your R2 credentials
3. **Supabase connection failed** - Check your service role key
4. **CSV file not found** - Ensure the CSV is in the correct location

### Debug Mode

The script includes extensive logging with emojis for easy identification:

- 🔍 R2 scanning progress
- 🔗 CSV matching results
- 💾 Database insertion status
- 🔐 Hash generation progress

## Next Steps

After running this script, you'll have:

1. ✅ Complete `library_tracks` table with R2 integration
2. ✅ Proper file keys for your R2 worker
3. ✅ Content hashes for deduplication
4. ✅ Rich metadata from your CSV
5. ✅ Support for versioned tracks

Your R2 worker will then be able to:

- Sign URLs using the `file_key` field
- Control access based on track metadata
- Provide proper caching headers
- Handle preview vs. full file access
