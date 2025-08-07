import { supabase } from './supabase';
import { StorageFile, UploadResponse, DownloadResponse, AudioFile } from '../types/music';

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
   * Upload an audio file to the user-uploads bucket
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

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(this.UPLOAD_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            title: title || file.name,
            originalName: file.name,
            size: file.size,
            type: file.type,
            uploadedBy: userId
          }
        });

      if (error) throw error;

      // Convert to StorageFile type
      const storageFile: StorageFile = {
        name: fileName,
        bucket_id: this.UPLOAD_BUCKET,
        owner: userId,
        id: data?.path || '',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {
          title: title || file.name,
          originalName: file.name,
          size: file.size,
          type: file.type,
          uploadedBy: userId
        }
      };

      return { data: storageFile, error: null };
    } catch (error) {
      console.error('Error uploading file:', error);
      return { data: null, error };
    }
  }

  /**
   * Upload a recording to the session-recordings bucket
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

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${sessionId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload file
      const { data, error } = await supabase.storage
        .from(this.RECORDING_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            originalName: file.name,
            size: file.size,
            type: file.type,
            sessionId,
            notes,
            uploadedBy: userId
          }
        });

      if (error) throw error;

      // Convert to StorageFile type
      const storageFile: StorageFile = {
        name: fileName,
        bucket_id: this.RECORDING_BUCKET,
        owner: userId,
        id: data?.path || '',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        metadata: {
          originalName: file.name,
          size: file.size,
          type: file.type,
          sessionId,
          notes,
          uploadedBy: userId
        }
      };

      return { data: storageFile, error: null };
    } catch (error) {
      console.error('Error uploading recording:', error);
      return { data: null, error };
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