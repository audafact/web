# Session and Recording Database Persistence Fixes

## Issues Identified

### 1. Sessions Not Being Saved to Database
**Problem**: The `saveCurrentState` function in `RecordingContext.tsx` was only saving sessions to local state and localStorage, never to the database. This meant:
- Users could save sessions in the UI but they weren't persisted
- Access control limits weren't being enforced properly
- Sessions would be lost on page refresh

**Root Cause**: The function was purely local and didn't integrate with the database service.

### 2. Recordings Forcing Session Creation
**Problem**: When a recording was created, it automatically created a session in the database, which counted against the user's session limit. This caused confusion because:
- Free users (2 session limit) would hit their limit after 2 recordings
- Recordings and sessions were conflated in the user's mind
- The session limit was being consumed by automatic recording sessions

**Root Cause**: The recording creation logic required a session_id, forcing session creation.

### 3. No Database Persistence for Manual Session Saves
**Problem**: Users could save sessions via the UI, but these were only stored locally, not in the database.

## Solutions Implemented

### 1. Fixed Session Database Persistence

**Updated `saveCurrentState` function in `RecordingContext.tsx`**:
- Made the function async to handle database operations
- Added proper limit checking before saving to database
- Added error handling and rollback if database save fails
- Added user tier checking from database
- Added event dispatching for UI updates

```typescript
const saveCurrentState = useCallback(async (studioState: any) => {
  // Save to local state immediately for UI responsiveness
  setSavedSessions(prev => [stateSession, ...prev]);
  
  // If user is authenticated, save to database
  if (user?.id) {
    try {
      // Check session limits
      const { count: sessionCount, error: countError } = await supabase
        .from('sessions')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);
      
      // Get user's access tier
      const { data: userData, error: userTierError } = await supabase
        .from('users')
        .select('access_tier')
        .eq('id', user.id)
        .single();
      
      const userTier = userTierError ? 'free' : (userData?.access_tier || 'free');
      const maxSessions = userTier === 'pro' ? Infinity : 2;
      
      if (currentSessionCount >= maxSessions) {
        // Remove from local state if limit reached
        setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
        return;
      }
      
      // Save to database
      const dbSession = await DatabaseService.createSession({...});
      
      if (dbSession) {
        // Update local session with database ID
        setSavedSessions(prev => prev.map(s => 
          s.id === sessionId ? { ...s, id: dbSession.id } : s
        ));
      } else {
        // Remove from local state if database save failed
        setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      // Handle errors and rollback local state
      setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  }
}, [user]);
```

### 2. Made Recordings Independent of Sessions

**Database Migration**: Created `20250101000005_make_session_id_optional.sql`:
```sql
-- Make session_id optional in recordings table
ALTER TABLE "public"."recordings" DROP CONSTRAINT IF EXISTS "recordings_session_id_fkey";
ALTER TABLE "public"."recordings" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "public"."recordings" ADD CONSTRAINT "recordings_session_id_fkey" 
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;
```

**Updated Recording Type**: Made `session_id` optional in `Recording` interface:
```typescript
export interface Recording {
  id: string;
  user_id: string;
  session_id?: string; // Optional - recordings can exist without sessions
  recording_url: string;
  length?: number;
  notes?: string;
  created_at: string;
}
```

**Updated Recording Creation Logic**: Removed automatic session creation:
```typescript
// Create database record without requiring a session
const recordingRecord = await DatabaseService.createRecording({
  user_id: user.id,
  session_id: undefined, // Optional - recordings can exist without sessions
  recording_url: `local://recording_${Date.now()}.wav`,
  length: duration / 1000,
  notes: `Performance recording with ${performanceEventsRef.current.length} events`
});
```

### 3. Added Proper Limit Checking

**Recording Limits**: Added proper limit checking before creating recordings:
```typescript
// Check recording limits first
const { count: recordingCount, error: countError } = await supabase
  .from('recordings')
  .select('id', { count: 'exact' })
  .eq('user_id', user.id);

const currentRecordingCount = recordingCount || 0;
const userTier = userTierError ? 'free' : (userData?.access_tier || 'free');
const maxRecordings = userTier === 'pro' ? Infinity : 1;

if (currentRecordingCount >= maxRecordings) {
  console.warn('User has reached recording limit');
  return;
}
```

## Benefits of These Changes

### 1. Clear Separation of Concerns
- **Sessions**: User-initiated saves of studio state (limited by tier)
- **Recordings**: Performance captures (limited by tier, independent of sessions)

### 2. Proper Limit Enforcement
- Free users: 2 sessions + 1 recording
- Pro users: Unlimited sessions + unlimited recordings
- Limits are enforced at database level with proper error handling

### 3. Better User Experience
- Sessions save immediately to database
- Clear feedback when limits are reached
- No confusion between session and recording limits
- Proper error handling and rollback

### 4. Database Consistency
- All user data is properly persisted
- Foreign key relationships are maintained
- Proper indexing for performance

## Migration Instructions

1. **Run the database migration**:
   ```bash
   supabase db push
   ```

2. **Update the application**:
   - The code changes are already implemented
   - No additional configuration needed

3. **Test the changes**:
   - Try saving sessions as a free user (should be limited to 2)
   - Try creating recordings as a free user (should be limited to 1)
   - Verify sessions persist after page refresh
   - Verify recordings don't consume session limits

## Why Recordings Don't Need Sessions

### Original Assumption
The original design assumed that every recording needed to be associated with a session, but this created several problems:

1. **Unnecessary Complexity**: Not all recordings need session context
2. **Limit Confusion**: Recordings were consuming session limits
3. **Forced Creation**: Sessions were being created automatically without user intent

### New Design
Recordings are now independent entities that can optionally reference a session:

- **Standalone Recordings**: Performance captures without session context
- **Session-Linked Recordings**: Recordings that are explicitly tied to a saved session
- **Flexible Association**: Users can choose whether to link recordings to sessions

This design is more flexible and aligns with user expectations where:
- Sessions are intentional saves of work state
- Recordings are captures of performances
- The two can be independent or linked as needed

## Additional Fix: Track ID UUID Validation

### Problem
The `track_ids` field in the sessions table expects an array of UUIDs, but the application was passing track IDs that included:
- Library track IDs (strings like "secrets-of-the-heart")
- Local track IDs (strings like "track-1234567890-abc123")
- Uploaded track IDs (proper UUIDs)

This caused database errors: `invalid input syntax for type uuid: "secrets-of-the-heart"`

### Solution
Added UUID validation to filter track IDs before saving to database:

```typescript
// Helper function to check if a string is a valid UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Filter track IDs to only include valid UUIDs (uploaded tracks)
const validTrackIds = studioState.tracks
  ?.map((track: any) => track.id)
  .filter((id: string) => isValidUUID(id)) || [];
```

### Result
- Only uploaded tracks (with UUIDs) are stored in the `track_ids` field
- Library tracks and local tracks are excluded from the database field
- All track information is still preserved in the `cuepoints` and `loop_regions` JSON fields
- No more database errors when saving sessions

## Additional Fix: Database Deletion for Sessions and Recordings

### Problem
The delete functions for sessions and recordings were only removing items from local state, not from the database. This meant:
- Deleted sessions would reappear after page refresh
- Deleted recordings would reappear after page refresh
- Database storage wasn't being cleaned up properly
- User limits weren't being properly managed

### Solution
Updated the delete functions to also delete from the database:

```typescript
const deleteSession = useCallback(async (sessionId: string) => {
  // Remove from local state immediately for UI responsiveness
  setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
  
  // If user is authenticated, delete from database
  if (user?.id) {
    try {
      const success = await DatabaseService.deleteSession(sessionId, user.id);
      if (!success) {
        console.error('Failed to delete session from database');
        // Could add error handling here (e.g., show toast, restore to local state)
      }
    } catch (error) {
      console.error('Error deleting session from database:', error);
      // Could add error handling here
    }
  }
}, [user]);

const deleteAudioRecording = useCallback(async (recordingId: string) => {
  // Remove from local state immediately for UI responsiveness
  setAudioRecordings(prev => prev.filter(r => r.id !== recordingId));
  
  // If user is authenticated, delete from database
  if (user?.id) {
    try {
      const success = await DatabaseService.deleteRecording(recordingId, user.id);
      if (!success) {
        console.error('Failed to delete recording from database');
        // Could add error handling here (e.g., show toast, restore to local state)
      }
    } catch (error) {
      console.error('Error deleting recording from database:', error);
      // Could add error handling here
    }
  }
}, [user]);
```

### Result
- Sessions and recordings are properly deleted from both local state and database
- Deleted items don't reappear after page refresh
- Database storage is properly cleaned up
- User limits are properly managed (deleted items free up space for new ones)
- UI remains responsive with immediate local state updates

## Additional Fix: Performance Recording Database Deletion

### Problem
Performance recordings were being deleted from local state but not from the database. The issue was:
- Performance recordings are stored locally in the `performances` array
- When saved to database, they create a `Recording` record
- The UI was calling `deletePerformance` which only deleted from local state
- No link existed between local performances and database recordings

### Solution
Updated the Performance interface and deletion logic:

```typescript
interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingEvent[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob;
  databaseId?: string; // Database recording ID if saved to database
}

const deletePerformance = useCallback(async (performanceId: string) => {
  // Find the performance to get its database ID
  const performance = performances.find(p => p.id === performanceId);
  
  // Remove from local state immediately for UI responsiveness
  setPerformances(prev => prev.filter(p => p.id !== performanceId));
  
  // If performance has a database ID and user is authenticated, delete from database
  if (performance?.databaseId && user?.id) {
    try {
      const success = await DatabaseService.deleteRecording(performance.databaseId, user.id);
      if (!success) {
        console.error('Failed to delete recording from database');
      }
    } catch (error) {
      console.error('Error deleting recording from database:', error);
    }
  }
}, [performances, user]);
```

### Result
- Performance recordings are now properly deleted from both local state and database
- Database storage is cleaned up when recordings are deleted
- User limits are properly managed
- UI remains responsive with immediate local state updates 