# Library Track Rotation System

This document explains how the library track rotation system works for limiting free users to 10 rotating tracks.

## Overview

The rotation system allows you to:
- Limit free users to exactly 10 tracks at any time
- Automatically rotate tracks weekly
- Provide pro users with access to all tracks
- Manage track availability through Supabase

## Database Schema

### `library_tracks` Table

```sql
CREATE TABLE public.library_tracks (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    track_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    artist TEXT,
    genre TEXT NOT NULL,
    bpm INTEGER,
    key TEXT,
    duration INTEGER,
    file_url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('wav', 'mp3')),
    size TEXT,
    tags TEXT[] DEFAULT '{}',
    is_pro_only BOOLEAN DEFAULT false,
    preview_url TEXT,
    is_active BOOLEAN DEFAULT true,
    rotation_week INTEGER, -- Week number when this track is available for free users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Key Fields

- `rotation_week`: The week number when this track is available for free users
- `is_pro_only`: If true, only pro users can access this track
- `is_active`: If false, the track is hidden from all users

## How It Works

### For Free Users
1. Only tracks with `rotation_week = current_week` are shown
2. Maximum of 10 tracks available at any time
3. Tracks automatically rotate weekly
4. Pro-only tracks are completely hidden

### For Pro Users
1. All active tracks are available (regardless of rotation_week)
2. Pro-only tracks are included
3. No limitations on track count

### For Guest Users
1. Same as free users (10 rotating tracks)
2. Cannot add tracks to studio (signup required)

## Database Functions

### `get_current_rotation_week()`
Returns the current week number since 2024-01-01.

### `get_free_user_tracks()`
Returns tracks available for free users in the current rotation week.

### `get_pro_user_tracks()`
Returns all active tracks for pro users.

## Frontend Implementation

### LibraryService
The `LibraryService` class handles all track fetching logic:

```typescript
// Get tracks based on user tier
const tracks = await LibraryService.getLibraryTracks(userTier);

// Get rotation info
const rotationInfo = await LibraryService.getCurrentRotationInfo();
```

### useLibraryTracks Hook
A React hook that manages library tracks state:

```typescript
const { tracks, isLoading, rotationInfo, refreshTracks } = useLibraryTracks();
```

## Managing Track Rotations

### Using the Rotation Script

The `scripts/rotate-tracks.js` script provides a CLI interface for managing rotations:

```bash
# Show current rotation status
node scripts/rotate-tracks.js status

# Rotate to next week
node scripts/rotate-tracks.js rotate

# Set specific tracks for a week
node scripts/rotate-tracks.js set-week 5 track1 track2 track3

# Clear rotation week for tracks
node scripts/rotate-tracks.js clear-week track1 track2
```

### Manual Database Management

You can also manage rotations directly in Supabase:

```sql
-- Set tracks for week 5
UPDATE library_tracks 
SET rotation_week = 5 
WHERE track_id IN ('track1', 'track2', 'track3');

-- Clear rotation week
UPDATE library_tracks 
SET rotation_week = NULL 
WHERE track_id IN ('track1', 'track2');

-- Get current week tracks
SELECT * FROM library_tracks 
WHERE rotation_week = get_current_rotation_week() 
AND is_active = true 
AND is_pro_only = false;
```

## Setting Up Rotations

### 1. Add Tracks to Database

```sql
INSERT INTO library_tracks (
    track_id, name, artist, genre, bpm, key, duration, 
    file_url, type, size, tags, is_pro_only, preview_url, rotation_week
) VALUES 
    ('track1', 'Track Name', 'Artist', 'house', 128, 'Am', 180, 
     '/audio/track1.wav', 'wav', '5.5MB', ARRAY['house', 'electronic'], false, '/previews/track1.mp3', 1);
```

### 2. Set Initial Rotation

```bash
# Set first 10 tracks for week 1
node scripts/rotate-tracks.js set-week 1 track1 track2 track3 track4 track5 track6 track7 track8 track9 track10
```

### 3. Schedule Weekly Rotations

You can set up a cron job or use a service like GitHub Actions to run weekly rotations:

```bash
# Add to crontab (runs every Monday at 2 AM)
0 2 * * 1 cd /path/to/your/app && node scripts/rotate-tracks.js rotate
```

## Customizing Rotation Logic

### Modify the Selection Algorithm

In `scripts/rotate-tracks.js`, you can customize the `selectTracksForWeek` method:

```javascript
selectTracksForWeek(allTracks, weekNumber) {
  // Your custom logic here
  // Examples:
  // - Random selection
  // - Genre-based rotation
  // - Popularity-based selection
  // - Manual curation
}
```

### Genre-Based Rotation

```javascript
selectTracksForWeek(allTracks, weekNumber) {
  const genres = ['house', 'techno', 'ambient', 'drum-n-bass'];
  const selectedTracks = [];
  
  // Select 2-3 tracks from each genre
  genres.forEach(genre => {
    const genreTracks = allTracks.filter(t => t.genre === genre);
    const startIndex = (weekNumber - 1) * 2;
    for (let i = 0; i < 2 && startIndex + i < genreTracks.length; i++) {
      selectedTracks.push(genreTracks[startIndex + i]);
    }
  });
  
  return selectedTracks.slice(0, 10);
}
```

## Monitoring and Analytics

### Track Usage Analytics

The system automatically tracks when users add tracks to their studio:

```typescript
trackEvent('library_track_added', {
  trackId: track.id,
  genre: track.genre,
  userTier: tier.id
});
```

### Rotation Performance

Monitor rotation effectiveness by tracking:
- Track popularity by rotation week
- User engagement with different track sets
- Conversion rates from free to pro

## Best Practices

### 1. Maintain Track Variety
- Include different genres in each rotation
- Mix popular and new tracks
- Consider seasonal themes

### 2. Monitor User Feedback
- Track which rotations perform best
- Adjust selection based on user behavior
- Keep popular tracks in rotation longer

### 3. Plan Ahead
- Prepare rotations 2-3 weeks in advance
- Have backup tracks ready
- Test rotations before going live

### 4. Communicate Changes
- Show users when new tracks are coming
- Explain the rotation system
- Highlight pro benefits

## Troubleshooting

### Common Issues

1. **No tracks showing for free users**
   - Check if tracks have `rotation_week` set
   - Verify `is_active = true` and `is_pro_only = false`

2. **Rotation not updating**
   - Check the `get_current_rotation_week()` function
   - Verify the reference date (2024-01-01)

3. **Pro users seeing limited tracks**
   - Check if `get_pro_user_tracks()` is being called
   - Verify user tier is correctly set to 'pro'

### Debug Queries

```sql
-- Check current week
SELECT get_current_rotation_week();

-- Check free user tracks
SELECT * FROM get_free_user_tracks();

-- Check all active tracks
SELECT * FROM library_tracks WHERE is_active = true;
``` 