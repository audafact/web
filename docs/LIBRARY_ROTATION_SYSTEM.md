# Library Track Rotation System

This document explains how the library track rotation system works for limiting free users to 10 rotating tracks with automated weekly rotation.

## Overview

The rotation system allows you to:
- Limit free users to exactly 10 tracks at any time
- Automatically rotate 3 tracks weekly
- Provide pro users with access to all tracks
- Track individual user library usage in the database
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

### `library_usage` Table (NEW)

```sql
CREATE TABLE public.library_usage (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES public.library_tracks(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rotation_week INTEGER NOT NULL, -- Week when the track was added
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, track_id, rotation_week)
);
```

### Key Fields

- `rotation_week`: The week number when this track is available for free users
- `is_pro_only`: If true, only pro users can access this track
- `is_active`: If false, the track is hidden from all users
- `user_id` + `track_id` + `rotation_week`: Unique constraint to prevent duplicate additions

## How It Works

### For Free Users
1. Only tracks with `rotation_week = current_week` are shown
2. Maximum of 10 tracks available at any time
3. Tracks automatically rotate weekly (3 new tracks per week)
4. Pro-only tracks are completely hidden
5. User's library usage is tracked in `library_usage` table

### For Pro Users
1. All active tracks are available (regardless of rotation_week)
2. Pro-only tracks are included
3. No limitations on track count
4. No usage tracking (unlimited access)

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

### `get_user_library_track_count(user_uuid UUID)`
Returns the number of library tracks a user has added in the current week.

### `add_library_track_to_user(user_uuid UUID, track_uuid UUID)`
Adds a library track to a user's collection, respecting limits.

### `remove_library_track_from_user(user_uuid UUID, track_uuid UUID)`
Removes a library track from a user's collection.

### `get_user_library_tracks(user_uuid UUID)`
Returns all library tracks currently in a user's collection.

### `rotate_free_user_tracks()`
Automatically rotates 3 tracks for the next week.

### `get_rotation_info()`
Returns current rotation information including next rotation date.

## Weekly Rotation Process

### Automatic Rotation
1. Runs every Monday at 00:00 UTC (configured in Supabase dashboard)
2. Selects 3 tracks that haven't been in rotation recently
3. Updates their `rotation_week` to the next week
4. Cleans up old usage records (older than 8 weeks)

### Manual Rotation
You can manually trigger rotation using the script:

```bash
node scripts/manual-rotation.js
```

## Usage Tracking

### Adding Tracks
When a free user adds a library track:
1. Check if user has reached their 10-track limit
2. Check if track is already in user's collection this week
3. If allowed, insert record into `library_usage` table
4. Track includes user_id, track_id, and current rotation_week

### Removing Tracks
When a user removes a track:
1. Mark the usage record as `is_active = false`
2. Track remains in database for analytics but doesn't count toward limit

### Weekly Reset
- Usage records are automatically cleaned up after 8 weeks
- New rotation week starts fresh for all users
- Previous week's usage doesn't affect new week's limits

## Frontend Integration

### AccessService
The `AccessService` class provides methods to:
- Check if user can add library tracks (`canPerformAction`)
- Add tracks to user's collection (`addLibraryTrackToUser`)
- Remove tracks from user's collection (`removeLibraryTrackFromUser`)
- Get user's current library tracks (`getUserLibraryTracks`)

### RotationInfo Component
Displays rotation information to free users:
- Current track count (X/10)
- Next rotation date
- Days until new tracks

### LibraryService
Updated to use new database functions for:
- Getting rotation information
- Fetching tracks based on user tier
- Managing track availability

## Configuration

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations

### Supabase Dashboard Setup
1. Create a scheduled function to run `rotate_free_user_tracks()` weekly
2. Set up RLS policies for the `library_usage` table
3. Configure appropriate indexes for performance

## Testing

### Manual Testing
1. Run the manual rotation script to test rotation logic
2. Test adding/removing tracks as different user tiers
3. Verify limits are enforced correctly
4. Check rotation information display

### Automated Testing
The system includes comprehensive tests for:
- Access control logic
- Usage tracking
- Rotation functions
- Database operations

## Monitoring

### Key Metrics
- Number of tracks added per user per week
- Rotation success/failure rates
- User engagement with library features
- Pro conversion rates from library usage

### Logs
- Rotation operations are logged with `RAISE NOTICE`
- Error handling includes detailed logging
- Usage tracking provides analytics data

## Future Enhancements

### Planned Features
- A/B testing different rotation schedules
- Personalized track recommendations
- Advanced analytics dashboard
- Bulk track management tools

### Performance Optimizations
- Caching frequently accessed data
- Optimizing database queries
- Implementing connection pooling
- Adding more granular indexes 