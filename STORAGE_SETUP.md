# Supabase Storage Integration Setup Guide

This guide covers the complete setup of Supabase Storage integration for the Audafact audio application.

## ✅ What's Been Implemented

### 1. Database Tables
- ✅ `users` - Extended user profiles with access tiers
- ✅ `uploads` - Audio file metadata storage
- ✅ `sessions` - Session management with track IDs and metadata
- ✅ `recordings` - Recording storage with session references
- ✅ Row Level Security (RLS) policies for all tables
- ✅ Proper indexing for performance

### 2. Storage Buckets
- ✅ `user-uploads` - For user audio file uploads
- ✅ `session-recordings` - For session recordings
- ✅ Storage policies for secure file access
- ✅ User-based folder structure

### 3. TypeScript Types
- ✅ Database entity types (`User`, `Upload`, `Session`, `Recording`)
- ✅ Storage types (`StorageFile`, `UploadResponse`, `DownloadResponse`)
- ✅ Audio file interface (`AudioFile`)

### 4. Services
- ✅ `StorageService` - File upload/download/management
- ✅ `DatabaseService` - Database operations
- ✅ File validation and metadata extraction
- ✅ Error handling and logging

### 5. React Components
- ✅ `SidePanel` - Integrated file management with drag & drop upload

## 🚀 How to Use

### 1. Upload Audio Files
The upload functionality is integrated directly into the `SidePanel` component:

```tsx
// Upload files through the SidePanel
// Navigate to "Tracks" → "My Tracks" in the sidebar
// Click "Upload Your First Track" or drag & drop files
```

### 2. Programmatic File Operations
```tsx
import { StorageService } from './services/storageService';
import { DatabaseService } from './services/databaseService';

// Upload a file
const result = await StorageService.uploadAudioFile(file, userId, title);

// Get user's uploads
const uploads = await DatabaseService.getUserUploads(userId);

// Create a session
const session = await DatabaseService.createSession({
  user_id: userId,
  session_name: "My Session",
  track_ids: [],
  cuepoints: [],
  loop_regions: [],
  mode: "loop"
});
```

## 🔧 Configuration Required

### 1. Environment Variables
Make sure your `.env` file has:
```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. Supabase Storage Policies
Run these SQL commands in your Supabase SQL Editor:

```sql
-- For user-uploads bucket
CREATE POLICY "Users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-uploads' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'user-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- For session-recordings bucket
CREATE POLICY "Users can upload recordings" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'session-recordings' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'session-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own recordings" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'session-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own recordings" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'session-recordings' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 🎯 Features Implemented

### File Upload
- ✅ Drag & drop interface
- ✅ File type validation (MP3, WAV, OGG, MP4, AAC, FLAC)
- ✅ File size limits (50MB max)
- ✅ Upload progress indication
- ✅ Automatic database record creation

### File Management
- ✅ List user's uploaded files
- ✅ Audio file preview with playback controls
- ✅ File deletion with database cleanup
- ✅ File metadata display (size, duration, type)

### Security
- ✅ Row Level Security (RLS) on all tables
- ✅ User-based file access control
- ✅ Secure file URLs with expiration
- ✅ Input validation and sanitization

### User Experience
- ✅ Loading states and error handling
- ✅ Responsive design with Tailwind CSS
- ✅ Audio playback controls
- ✅ File organization by user and session

## 🔍 Testing the Setup

1. **Upload a file:**
   - Navigate to your app
   - Open the SidePanel (click the hamburger menu)
   - Go to "Tracks" → "My Tracks" 
   - Click "Upload Your First Track" or drag and drop an audio file
   - Verify it appears in the list

2. **Check database:**
   - Go to Supabase Dashboard → Table Editor
   - Check the `uploads` table for new records
   - Verify RLS is working (only your files visible)

3. **Check storage:**
   - Go to Supabase Dashboard → Storage
   - Check the `user-uploads` bucket
   - Verify files are in user-specific folders

4. **Test playback:**
   - Click play on an uploaded file
   - Verify audio controls work
   - Check that only one file plays at a time

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid API key" error:**
   - Check environment variables are set correctly
   - Ensure you're using the anon key, not service role key

2. **Upload fails:**
   - Check file size (max 50MB)
   - Verify file type is supported
   - Check browser console for errors

3. **Files not visible:**
   - Verify RLS policies are set up correctly
   - Check user authentication status
   - Ensure database records were created

4. **Audio won't play:**
   - Check file URL is accessible
   - Verify CORS settings in Supabase
   - Check browser audio permissions

### Getting Help
- Check Supabase logs in the dashboard
- Review browser console for errors
- Verify all SQL commands were executed successfully

## 📈 Next Steps

After this setup is complete, you can:

1. **Enhance the existing integration:**
   - Add file management features to other components
   - Connect uploads to your audio context
   - Implement session-based file organization

2. **Add advanced features:**
   - File sharing between users
   - Batch upload capabilities
   - Audio processing and analysis
   - Cloud storage optimization

3. **Enhance security:**
   - Add file encryption
   - Implement virus scanning
   - Add audit logging

4. **Performance optimization:**
   - Implement file caching
   - Add CDN integration
   - Optimize file compression

## 🎉 Success!

Your Supabase Storage integration is now complete and ready to use! Users can upload, manage, and play audio files with full security and a great user experience. 