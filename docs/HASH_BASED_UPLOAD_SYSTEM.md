# Hash-Based Upload System

This document describes the implementation of the new hash-based upload system that migrates all storage from Supabase Storage to R2 storage using content hashing.

## Overview

The new upload system provides:
- Content-based deduplication using SHA-256 hashes
- R2 storage integration via signed URLs
- Improved scalability and performance
- Better metadata tracking
- **Unified storage service** - all uploads now use the same StorageService

## Architecture

### 1. Upload Flow

```
User File → Hash Computation → Key Generation → Signed URL → R2 Upload → Database Record
```

### 2. Components

#### Refactored StorageService (`src/services/storageService.ts`)
- **Modified existing service** instead of creating a new one
- All upload methods now use R2 storage with hash computation
- Maintains backward compatibility with existing UploadResponse format
- Includes new hash-based metadata in StorageFile objects

#### API Configuration (`src/config/api.ts`)
- Centralized API endpoint configuration
- Environment variable management
- URL building utilities

#### Database Service Updates
- New `createHashBasedUpload` method
- Support for hash-related fields
- Improved metadata storage

## Implementation Details

### Hash Computation
- Uses `sha256Blob()` from `src/lib/hash.ts`
- Generates both full hash and short hash (10 characters)
- Enables content-based deduplication

### Key Generation
- Uses `userUploadKey()` from `src/lib/keys.ts`
- Format: `users/{userId}/uploads/{uuid}-{slugified-title}.{ext}`
- Includes UUID for uniqueness

### R2 Storage
- Files uploaded via signed PUT URLs
- Server generates authoritative keys
- Supports large file uploads efficiently

### Database Schema
New fields added to `uploads` table:
- `full_hash`: SHA-256 hash of file content
- `short_hash`: Short version for display
- `server_key`: R2 storage key
- `size_bytes`: File size in bytes
- `content_type`: MIME type
- `original_name`: Original filename

## Migration Strategy

### Why We Refactored Instead of Creating New Service

1. **Unified Architecture**: All storage operations now use the same service
2. **Backward Compatibility**: Existing code continues to work without changes
3. **Consistency**: Same validation, error handling, and response format
4. **Maintainability**: Single service to maintain instead of two separate ones
5. **Future-Proof**: Easy to extend for other storage operations

### What Changed

- **`uploadAudioFile()`**: Now uses R2 + hash computation instead of Supabase Storage
- **`uploadRecording()`**: Also migrated to R2 + hash computation
- **Response Format**: Maintains same `UploadResponse` structure for compatibility
- **Metadata**: Enhanced with hash information while preserving existing fields

## Usage

### Frontend Integration (No Changes Required)

```typescript
import { StorageService } from '../services/storageService';

// Existing code continues to work
const result = await StorageService.uploadAudioFile(file, userId, title);

if (result.error) {
  // Handle error
} else if (result.data) {
  // Use result.data as before
  // Now includes additional hash metadata
  console.log('File hash:', result.data.metadata.fullHash);
}
```

### Database Integration

```typescript
import { DatabaseService } from '../services/databaseService';

// Create upload record with hash metadata
const uploadRecord = await DatabaseService.createHashBasedUpload(
  userId,
  title,
  serverKey,
  fullHash,
  shortHash,
  sizeBytes,
  contentType,
  originalName,
  duration
);
```

### Duplicate Detection

```typescript
// Check if file already exists
const isDuplicate = await StorageService.checkDuplicateFile(fullHash, userId);

if (isDuplicate) {
  // Handle duplicate file case
  const existingFile = await StorageService.getFileByHash(fullHash, userId);
}
```

## Configuration

### Environment Variables
```bash
VITE_API_BASE_URL=https://api.audafact.com
```

### API Endpoints
- `POST /api/sign-upload` - Get signed upload URL

## Benefits of Refactoring Approach

1. **Single Source of Truth**: One service handles all storage operations
2. **Easier Maintenance**: No duplicate code or conflicting implementations
3. **Consistent API**: Same method signatures and response formats
4. **Gradual Migration**: Can migrate other methods one by one
5. **Better Testing**: Single test suite covers all storage functionality

## Future Enhancements

1. **Library Track Support**: Extend to `libOriginalKey()` for admin uploads
2. **Batch Uploads**: Support for multiple file uploads
3. **Progress Tracking**: Upload progress indicators
4. **Resumable Uploads**: Support for large file resume
5. **CDN Integration**: Automatic CDN distribution

## Error Handling

The system includes comprehensive error handling:
- Network failures during upload
- Invalid file types/sizes
- Authentication token issues
- Database operation failures
- R2 storage errors

## Testing

Test coverage includes:
- Hash computation accuracy
- Key generation uniqueness
- Upload flow integration
- Error handling scenarios
- Database record creation
- Backward compatibility

## Migration Checklist

- [x] Refactor `StorageService.uploadAudioFile()` to use R2 + hashing
- [x] Refactor `StorageService.uploadRecording()` to use R2 + hashing
- [x] Add hash-based metadata to StorageFile objects
- [x] Update database schema with new fields
- [x] Maintain backward compatibility with existing code
- [x] Update tests to cover new functionality
- [x] Remove separate UploadService (no longer needed)
- [ ] Deploy database migration
- [ ] Configure API endpoint for signed URLs
- [ ] Test end-to-end upload flow
