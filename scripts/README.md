# R2 Library Population Script

This script populates your `library_tracks` table in Supabase with data from your R2 bucket and CSV file.

## What It Does

1. **Scans R2 bucket** (`audafact/library/originals`) for all MP3 files
2. **Parses track names and short hashes** from filenames
3. **Matches tracks to CSV data** using fuzzy string matching
4. **Generates content hashes** by downloading and hashing each file
5. **Populates the database** with proper file keys and metadata
6. **Handles versioned tracks** (e.g., `song-name-version-1-hash.mp3`)

## Setup

### 1. Install Dependencies

```bash
cd web/scripts
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the `web/scripts` directory:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# Optional: Override default values
R2_BUCKET=audafact
CSV_FILE=./audafact-track-genre-and-tags - Sheet1.csv
```

### 3. Place CSV File

Put your `audafact-track-genre-and-tags - Sheet1.csv` file in the `web/scripts` directory.

## Usage

### Run the Full Script

```bash
npm start
```

### Run Individual Functions

```javascript
import {
  getR2Tracks,
  parseR2Key,
  matchTracksToCSV,
} from "./populate-library-from-r2.js";

// Get tracks from R2
const r2Tracks = await getR2Tracks();

// Parse a specific key
const trackInfo = parseR2Key(
  "library/originals/this-loves-a-serenade-version-1-a1b2c3d4.mp3"
);

// Match tracks to CSV
const matchedTracks = matchTracksToCSV(r2Tracks, csvTracks);
```

## How It Works

### R2 Key Parsing

The script parses R2 keys like:

- `library/originals/song-name-hash.mp3` → `trackId: "song-name", hash: "hash"`
- `library/originals/song-name-version-1-hash.mp3` → `trackId: "song-name", version: 1, hash: "hash"`

### CSV Matching

Uses fuzzy string matching to connect R2 filenames to CSV entries:

- R2: `this-loves-a-serenade-version-1-a1b2c3d4`
- CSV: `This Love's a Serenade`
- Match: ✅ (high similarity score)

### Database Schema

Creates records with:

- `track_id`: `song-name-hash` (unique identifier)
- `file_key`: Full R2 key path
- `preview_key`: Preview file path
- `short_hash`: Extracted hash
- `content_hash`: Generated SHA-256 hash
- `genre`: Array from CSV
- `tags`: Array from CSV

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

## Troubleshooting

### Common Issues

1. **Environment variables not set** - Check your `.env` file
2. **R2 access denied** - Verify your R2 credentials
3. **Supabase connection failed** - Check your service role key
4. **CSV file not found** - Ensure the CSV is in the correct location

### Debug Mode

The script includes extensive logging. Look for:

- 🔍 R2 scanning progress
- 🔗 CSV matching results
- 💾 Database insertion status
- 🔐 Hash generation progress

## Performance Notes

- **Hash generation** downloads each file (can be slow for large libraries)
- **Batch insertion** processes tracks in groups of 10
- **Rate limiting** includes delays to avoid overwhelming R2
- **Memory usage** streams files to avoid loading entire files into memory
