# PRD: Phase 4 - Frontend Integration

## Overview

Integrate the new Worker-based media API with the frontend application, replacing all legacy public URL usage with secure signed URL requests. This phase ensures the client never constructs public URLs and always uses the Worker for media access.

## Objectives

- Implement upload flow using Worker /api/sign-upload
- Replace all getPublicUrl() calls with Worker signing
- Update preview flows to use ephemeral signed URLs
- Clean up LibraryService and remove legacy dependencies
- Ensure drag-and-drop uses fileKey payloads

## Success Criteria

- [ ] Upload flow fully functional with Worker integration
- [ ] All preview components use signed URLs
- [ ] LibraryService returns fileKey only
- [ ] Drag-and-drop payloads contain fileKey
- [ ] No legacy file_url dependencies remain
- [ ] All components use useSingleAudio pattern

## Technical Requirements

### Upload Flow Implementation

#### Upload Component Updates

```typescript
// Before: Direct Supabase upload
const { data, error } = await supabase.storage
  .from("uploads")
  .upload(path, file);

// After: Worker signing + R2 upload
const signResponse = await signFile({
  filename: file.name,
  contentType: file.type,
  sizeBytes: file.size,
  title: title,
});

// Upload to R2 using presigned URL
const uploadResponse = await fetch(signResponse.url, {
  method: "PUT",
  body: file,
  headers: {
    "Content-Type": file.type,
  },
});

// Create database record
await createUploadRecord({
  fileKey: signResponse.key,
  contentType: file.type,
  sizeBytes: file.size,
  title: title,
});
```

#### Upload Service Integration

```typescript
export class UploadService {
  async uploadFile(file: File, title?: string): Promise<UploadResult> {
    // Step 1: Get presigned URL from Worker
    const signResponse = await this.workerApi.signUpload({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      title,
    });

    // Step 2: Upload to R2
    const uploadResult = await this.uploadToR2(signResponse.url, file);

    // Step 3: Create database record
    const dbRecord = await this.createUploadRecord(
      signResponse.key,
      file,
      title
    );

    return {
      fileKey: signResponse.key,
      url: signResponse.url,
      dbRecord,
    };
  }
}
```

### Preview Flow Refactor

#### useSingleAudio Integration

```typescript
// Before: Direct URL usage
const audio = new Audio(track.file_url);
audio.play();

// After: Worker signing + useSingleAudio
const { toggle, stop, isPlaying } = useSingleAudio();

const handlePreviewPlay = async (track: Track) => {
  if (isCurrentKey(track.fileKey)) {
    toggle();
    return;
  }

  // Get fresh signed URL for each play
  const signedUrl = await signFile(track.fileKey);
  play(track.fileKey, signedUrl);
};
```

#### Preview Hook Updates

```typescript
export function usePreviewAudio() {
  const { toggle, stop, isPlaying, currentKey } = useSingleAudio();

  const startPreview = useCallback(
    async (fileKey: string) => {
      const signedUrl = await signFile(fileKey);
      play(fileKey, signedUrl);
    },
    [play]
  );

  const stopPreview = useCallback(() => {
    stop();
  }, [stop]);

  return {
    startPreview,
    stopPreview,
    togglePreview: toggle,
    isPreviewing: isPlaying,
  };
}
```

### LibraryService Cleanup

#### Remove Public URL Methods

```typescript
// Before: Public URL construction
export class LibraryService {
  getLibraryTrackUrl(track: LibraryTrack): string {
    return `${STORAGE_URL}/${track.file_url}`;
  }
}

// After: FileKey only
export class LibraryService {
  getLibraryTrackKey(track: LibraryTrack): string {
    return track.file_key;
  }

  // Remove all getPublicUrl methods
  // Remove file_url construction logic
}
```

#### Update All Consumers

```typescript
// Before: Using public URLs
const trackUrl = libraryService.getLibraryTrackUrl(track);
const audio = new Audio(trackUrl);

// After: Using fileKey + Worker signing
const fileKey = libraryService.getLibraryTrackKey(track);
const signedUrl = await signFile(fileKey);
play(fileKey, signedUrl);
```

### Drag-and-Drop Updates

#### Payload Structure

```typescript
// Before: File URL payload
interface DragPayload {
  type: "track";
  track: Track;
  fileUrl: string;
}

// After: FileKey payload
interface DragPayload {
  type: "track";
  track: Track;
  fileKey: string;
  metadata: {
    title: string;
    contentType: string;
    sizeBytes: number;
  };
}
```

#### Studio Integration

```typescript
// Before: Direct URL usage in studio
const handleDrop = (payload: DragPayload) => {
  const audio = new Audio(payload.fileUrl);
  // ... studio logic
};

// After: Worker signing in studio
const handleDrop = async (payload: DragPayload) => {
  const signedUrl = await signFile(payload.fileKey);
  const audio = new Audio(signedUrl);
  // ... studio logic
};
```

## Implementation Steps

### Step 1: Upload Flow Implementation

1. Update upload components to use Worker signing
2. Implement R2 upload after getting presigned URL
3. Add success callback for database record creation
4. Handle upload errors and quota exceeded scenarios
5. Update upload progress indicators

### Step 2: Preview Flow Refactor

1. Replace all getPublicUrl() calls with Worker signing
2. Update useSingleAudio to always request fresh signed URLs
3. Implement ephemeral URL handling (no caching in state)
4. Update all preview components to use new flow
5. Test preview functionality across all components

### Step 3: LibraryService Cleanup

1. Remove all public URL construction methods
2. Ensure all consumers use fileKey + Worker signing
3. Update drag-and-drop payloads to use fileKey
4. Remove legacy file_url dependencies
5. Update type definitions

### Step 4: Component Updates

1. Update SidePanel to use new preview flow
2. Update LibraryTrackItem preview handling
3. Update studio drag-and-drop handling
4. Update any remaining components using legacy URLs
5. Test all user flows end-to-end

## Dependencies

- Phase 3: Worker API Core (for upload and signing endpoints)

## Risks & Mitigation

- **Risk**: Breaking existing preview functionality
  - **Mitigation**: Implement gradually with fallbacks
- **Risk**: Performance degradation from additional API calls
  - **Mitigation**: Implement caching and optimize Worker responses
- **Risk**: Upload failures breaking user experience
  - **Mitigation**: Comprehensive error handling and retry logic

## Testing Requirements

- [ ] Upload flow works end-to-end
- [ ] All preview components function correctly
- [ ] Drag-and-drop operations work with fileKey
- [ ] No legacy URL construction remains
- [ ] Performance meets requirements
- [ ] Error handling works for all scenarios

## Performance Requirements

- Preview start time: <500ms from click to audio start
- Upload success rate: >95%
- No regression in user experience
- Smooth drag-and-drop operations

## Definition of Done

- [ ] Upload flow fully functional
- [ ] All preview components updated
- [ ] LibraryService cleaned up
- [ ] Drag-and-drop using fileKey
- [ ] No legacy dependencies remain
- [ ] All tests passing
- [ ] End-to-end testing completed
- [ ] Performance validated
- [ ] Documentation updated
