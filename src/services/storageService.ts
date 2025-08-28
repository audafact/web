import { supabase } from './supabase';
import { StorageFile, UploadResponse, DownloadResponse, AudioFile } from '../types/music';
import { sha256Blob, shortHex } from '../lib/hash';
import { buildApiUrl, API_CONFIG } from '../config/api';

export class StorageService {
  private static readonly UPLOAD_BUCKET = 'user-uploads';
  private static readonly RECORDING_BUCKET = 'session-recordings';
  private static readonly LIBRARY_BUCKET = 'library-tracks';
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    'audio/flac'
  ];

  /**
   * Upload an audio file to R2 storage with hash computation and key generation
   */
  static async uploadAudioFile(
    file: File,
    userId: string,
    title?: string
  ): Promise<UploadResponse> {
    try {
      // Validate file
      if (!this.isValidAudioFile(file)) {
        throw new Error('Invalid file type or size');
      }

      // 1) Compute hash and build key
      const fullHash = await sha256Blob(file);
      const shortHash = shortHex(fullHash, 10);
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();

      // 2) Get signed PUT URL from API
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const signedUploadResponse = await this.getSignedUploadUrl(
        file.type || 'application/octet-stream',
        ext,
        token
      );

      // 3) Upload to R2 using signed URL
      const uploadResponse = await fetch(signedUploadResponse.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // 4) Convert to StorageFile type for backward compatibility
      const storageFile: StorageFile = {
        name: signedUploadResponse.key, // Use server key as name
        bucket_id: 'r2-storage', // Indicate R2 storage
        owner: userId,
        id: signedUploadResponse.key,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {
          title: title || file.name,
          originalName: file.name,
          size: file.size,
          type: file.type,
          uploadedBy: userId,
          // New hash-based metadata
          fullHash,
          shortHash,
          serverKey: signedUploadResponse.key,
          sizeBytes: file.size,
          contentType: file.type || 'application/octet-stream',
        }
      };

      return { data: storageFile, error: null };
    } catch (error) {
      console.error('Error uploading file:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a signed upload URL from the API for R2 storage
   */
  private static async getSignedUploadUrl(
    contentType: string,
    ext: string,
    token: string
  ): Promise<{ url: string; key: string }> {
    const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SIGN_UPLOAD), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        contentType,
        ext,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed upload URL: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      key: data.key,
    };
  }

  /**
   * Upload a recording to R2 storage with hash computation
   */
  static async uploadRecording(
    file: File,
    userId: string,
    sessionId: string,
    notes?: string
  ): Promise<UploadResponse> {
    try {
      // Validate file
      if (!this.isValidAudioFile(file)) {
        throw new Error('Invalid file type or size');
      }

      // 1) Compute hash and build key
      const fullHash = await sha256Blob(file);
      const shortHash = shortHex(fullHash, 10);
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();

      // 2) Get signed PUT URL from API
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const signedUploadResponse = await this.getSignedUploadUrl(
        file.type || 'application/octet-stream',
        ext,
        token
      );

      // 3) Upload to R2 using signed URL
      const uploadResponse = await fetch(signedUploadResponse.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }

      // 4) Convert to StorageFile type for backward compatibility
      const storageFile: StorageFile = {
        name: signedUploadResponse.key, // Use server key as name
        bucket_id: 'r2-storage', // Indicate R2 storage
        owner: userId,
        id: signedUploadResponse.key,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {
          originalName: file.name,
          size: file.size,
          type: file.type,
          sessionId,
          notes,
          uploadedBy: userId,
          // New hash-based metadata
          fullHash,
          shortHash,
          serverKey: signedUploadResponse.key,
          sizeBytes: file.size,
          contentType: file.type || 'application/octet-stream',
        }
      };

      return { data: storageFile, error: null };
    } catch (error) {
      console.error('Error uploading recording:', error);
      return { data: null, error };
    }
  }

  /**
   * Check if a file with the same hash already exists
   * This can be used to prevent duplicate uploads
   */
  static async checkDuplicateFile(fullHash: string, userId: string): Promise<boolean> {
    try {
      // Query the database to check if a file with this hash exists
      const { data, error } = await supabase
        .from('uploads')
        .select('id')
        .eq('full_hash', fullHash)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return !!data; // Returns true if file exists, false otherwise
    } catch (error) {
      console.error('Error checking for duplicate file:', error);
      return false; // Assume no duplicate on error
    }
  }

  /**
   * Get file info by hash
   */
  static async getFileByHash(fullHash: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('full_hash', fullHash)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting file by hash:', error);
      return null;
    }
  }

  /**
   * Download a file from storage
   */
  static async downloadFile(
    bucket: string,
    filePath: string
  ): Promise<DownloadResponse> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error downloading file:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a signed URL for a file (for private buckets)
   */
  static async getSignedUrl(bucket: string, filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);
      
      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }
  }

  /**
   * Get a public URL for a file (for public buckets)
   */
  static getPublicUrl(bucket: string, filePath: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }

  /**
   * List files in a bucket for a specific user
   */
  static async listUserFiles(
    bucket: string,
    userId: string,
    folder?: string
  ): Promise<{ data: StorageFile[] | null; error: any }> {
    try {
      const path = folder ? `${userId}/${folder}` : userId;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Error listing files:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(
    bucket: string,
    filePath: string
  ): Promise<{ error: any }> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { error };
    }
  }

  /**
   * Get audio file metadata and create AudioFile object
   */
  static async getAudioFileInfo(
    bucket: string,
    filePath: string
  ): Promise<AudioFile | null> {
    try {
      // Get file metadata
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list(filePath.split('/').slice(0, -1).join('/'), {
          search: filePath.split('/').pop()
        });

      if (error || !files || files.length === 0) {
        throw new Error('File not found');
      }

      const file = files[0];
      const publicUrl = this.getPublicUrl(bucket, filePath);

      // Get audio duration (this would need to be implemented with Web Audio API)
      const duration = await this.getAudioDuration(publicUrl);

      return {
        id: file.id,
        name: file.name,
        url: publicUrl,
        duration: duration || 0,
        size: file.metadata?.size || 0,
        type: file.metadata?.type || 'audio/mpeg',
        uploaded_at: file.created_at
      };
    } catch (error) {
      console.error('Error getting audio file info:', error);
      return null;
    }
  }

  /**
   * Upload a library track to the library-tracks bucket
   */
  static async uploadLibraryTrack(
    file: File,
    trackId: string,
    metadata?: {
      name: string;
      artist?: string;
      genre: string;
      bpm?: number;
      key?: string;
      duration?: number;
      tags?: string[];
    }
  ): Promise<UploadResponse> {
    try {
      // Validate file
      if (!this.isValidAudioFile(file)) {
        throw new Error('Invalid file type or size');
      }

      // Create filename using track ID
      const fileExt = file.name.split('.').pop();
      const fileName = `${trackId}.${fileExt}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(this.LIBRARY_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Allow overwriting
          metadata: {
            trackId,
            originalName: file.name,
            size: file.size,
            type: file.type,
            ...metadata
          }
        });

      if (error) throw error;

      // Convert to StorageFile type
      const storageFile: StorageFile = {
        name: fileName,
        bucket_id: this.LIBRARY_BUCKET,
        owner: 'system',
        id: data?.path || '',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {
          trackId,
          originalName: file.name,
          size: file.size,
          type: file.type,
          ...metadata
        }
      };

      return { data: storageFile, error: null };
    } catch (error) {
      console.error('Error uploading library track:', error);
      return { data: null, error };
    }
  }

  /**
   * Get the public URL for a library track
   */
  static getLibraryTrackUrl(trackId: string, fileType: string): string {
    return this.getPublicUrl(this.LIBRARY_BUCKET, `${trackId}.${fileType}`);
  }

  /**
   * Get a signed URL for a library track (if needed for private access)
   */
  static async getLibraryTrackSignedUrl(trackId: string, fileType: string, expiresIn: number = 3600): Promise<string> {
    return this.getSignedUrl(this.LIBRARY_BUCKET, `${trackId}.${fileType}`, expiresIn);
  }

  /**
   * Get audio duration using Web Audio API
   */
  private static async getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        resolve(0);
      });
      audio.src = url;
    });
  }

  /**
   * Validate if a file is a valid audio file
   */
  private static isValidAudioFile(file: File): boolean {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return false;
    }

    // Check file type
    if (!this.ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return false;
    }

    return true;
  }

  /**
   * Get file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get duration in human readable format
   */
  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
} 