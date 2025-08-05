import { supabase } from './supabase';
import { LibraryTrack } from '../types/music';

export interface DatabaseLibraryTrack {
  id: string;
  track_id: string;
  name: string;
  artist: string | null;
  genre: string;
  bpm: number | null;
  key: string | null;
  duration: number | null;
  file_url: string;
  type: 'wav' | 'mp3';
  size: string | null;
  tags: string[];
  is_pro_only: boolean;
  preview_url: string | null;
  rotation_week: number | null;
}

export class LibraryService {
  /**
   * Get library tracks based on user tier
   * Free users get 10 rotating tracks, pro users get all tracks
   */
  static async getLibraryTracks(userTier: 'guest' | 'free' | 'pro'): Promise<LibraryTrack[]> {
    try {
      let query = supabase
        .from('library_tracks')
        .select('*')
        .eq('is_active', true);

      // For free users, only get tracks for current rotation week
      if (userTier === 'free') {
        query = query.eq('is_pro_only', false);
        // We'll filter by rotation week in the database function
        const { data, error } = await supabase.rpc('get_free_user_tracks');
        if (error) throw error;
        return this.transformDatabaseTracks(data || []);
      }

      // For pro users, get all tracks
      if (userTier === 'pro') {
        const { data, error } = await supabase.rpc('get_pro_user_tracks');
        if (error) throw error;
        return this.transformDatabaseTracks(data || []);
      }

      // For guests, get free tracks for current rotation week
      const { data, error } = await supabase.rpc('get_free_user_tracks');
      if (error) throw error;
      return this.transformDatabaseTracks(data || []);
    } catch (error) {
      console.error('Error fetching library tracks:', error);
      return [];
    }
  }

  /**
   * Get tracks by genre
   */
  static async getTracksByGenre(genre: string, userTier: 'guest' | 'free' | 'pro'): Promise<LibraryTrack[]> {
    const tracks = await this.getLibraryTracks(userTier);
    return tracks.filter(track => track.genre === genre);
  }

  /**
   * Get available genres for current user tier
   */
  static async getAvailableGenres(userTier: 'guest' | 'free' | 'pro'): Promise<string[]> {
    const tracks = await this.getLibraryTracks(userTier);
    return [...new Set(tracks.map(track => track.genre))];
  }

  /**
   * Get track by ID
   */
  static async getTrackById(trackId: string, userTier: 'guest' | 'free' | 'pro'): Promise<LibraryTrack | null> {
    const tracks = await this.getLibraryTracks(userTier);
    return tracks.find(track => track.id === trackId) || null;
  }

  /**
   * Get current rotation week info
   */
  static async getCurrentRotationInfo(): Promise<{ weekNumber: number; trackCount: number }> {
    try {
      const { data, error } = await supabase.rpc('get_free_user_tracks');
      if (error) throw error;
      
      return {
        weekNumber: new Date().getTime() / (1000 * 60 * 60 * 24 * 7), // Rough week calculation
        trackCount: data?.length || 0
      };
    } catch (error) {
      console.error('Error getting rotation info:', error);
      return { weekNumber: 1, trackCount: 0 };
    }
  }

  /**
   * Transform database track to LibraryTrack format
   */
  private static transformDatabaseTracks(dbTracks: DatabaseLibraryTrack[]): LibraryTrack[] {
    return dbTracks.map(dbTrack => ({
      id: dbTrack.track_id,
      name: dbTrack.name,
      artist: dbTrack.artist || undefined,
      genre: dbTrack.genre,
      bpm: dbTrack.bpm || 0,
      key: dbTrack.key || undefined,
      duration: dbTrack.duration || 0,
      file: dbTrack.file_url, // This will be the URL to fetch the file
      type: dbTrack.type,
      size: dbTrack.size || 'Unknown',
      tags: dbTrack.tags,
      isProOnly: dbTrack.is_pro_only,
      previewUrl: dbTrack.preview_url || undefined
    }));
  }

  /**
   * Fetch audio file from URL
   */
  static async fetchAudioFile(fileUrl: string): Promise<File> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const fileName = fileUrl.split('/').pop() || 'audio.wav';
      
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('Error fetching audio file:', error);
      throw error;
    }
  }

  /**
   * Get track count for current user tier
   */
  static async getTrackCount(userTier: 'guest' | 'free' | 'pro'): Promise<number> {
    const tracks = await this.getLibraryTracks(userTier);
    return tracks.length;
  }
} 