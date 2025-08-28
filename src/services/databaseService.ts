import { supabase } from './supabase';
import { User, Upload, Session, Recording } from '../types/music';

export class DatabaseService {
  /**
   * Get current user's profile
   */
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  /**
   * Create a new upload record
   */
  static async createUpload(upload: Omit<Upload, 'id' | 'created_at'>): Promise<Upload | null> {
    try {
      const { data, error } = await supabase
        .from('uploads')
        .insert(upload)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating upload:', error);
      return null;
    }
  }

  /**
   * Create a new hash-based upload record with R2 storage metadata
   */
  static async createHashBasedUpload(
    userId: string,
    title: string,
    serverKey: string,
    fullHash: string,
    shortHash: string,
    sizeBytes: number,
    contentType: string,
    originalName: string,
    duration?: number
  ): Promise<Upload | null> {
    try {
      const uploadData = {
        user_id: userId,
        file_url: serverKey, // Use server key as file_url for R2 storage
        title,
        duration,
        // New hash-based fields
        full_hash: fullHash,
        short_hash: shortHash,
        server_key: serverKey,
        size_bytes: sizeBytes,
        content_type: contentType,
        original_name: originalName,
      };

      const { data, error } = await supabase
        .from('uploads')
        .insert(uploadData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating hash-based upload:', error);
      return null;
    }
  }

  /**
   * Get user's uploads
   */
  static async getUserUploads(userId: string): Promise<Upload[]> {
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user uploads:', error);
      return [];
    }
  }

  /**
   * Delete an upload
   */
  static async deleteUpload(uploadId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting upload:', error);
      return false;
    }
  }

  /**
   * Create a new session
   */
  static async createSession(session: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<Session | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  /**
   * Get user's sessions
   */
  static async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Get a specific session
   */
  static async getSession(sessionId: string, userId: string): Promise<Session | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Update a session
   */
  static async updateSession(
    sessionId: string,
    userId: string,
    updates: Partial<Session>
  ): Promise<Session | null> {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating session:', error);
      return null;
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  /**
   * Create a new recording
   */
  static async createRecording(recording: Omit<Recording, 'id' | 'created_at'>): Promise<Recording | null> {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .insert(recording)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating recording:', error);
      return null;
    }
  }

  /**
   * Get recordings for a session
   */
  static async getSessionRecordings(sessionId: string, userId: string): Promise<Recording[]> {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting session recordings:', error);
      return [];
    }
  }

  /**
   * Get user's recordings
   */
  static async getUserRecordings(userId: string): Promise<Recording[]> {
    try {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user recordings:', error);
      return [];
    }
  }

  /**
   * Delete a recording
   */
  static async deleteRecording(recordingId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }

  /**
   * Get session with all related data
   */
  static async getSessionWithData(sessionId: string, userId: string): Promise<{
    session: Session | null;
    uploads: Upload[];
    recordings: Recording[];
  }> {
    try {
      const [session, uploads, recordings] = await Promise.all([
        this.getSession(sessionId, userId),
        this.getUserUploads(userId),
        this.getSessionRecordings(sessionId, userId)
      ]);

      return {
        session,
        uploads,
        recordings
      };
    } catch (error) {
      console.error('Error getting session with data:', error);
      return {
        session: null,
        uploads: [],
        recordings: []
      };
    }
  }
} 