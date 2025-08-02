import { supabase } from './supabase';
import { DatabaseService } from './databaseService';

export interface AccessLimits {
  maxUploads: number;
  maxSessions: number;
  maxRecordings: number;
  maxLibraryTracks: number;
  canDownload: boolean;
}

export interface AccessStatus {
  currentUploads: number;
  currentSessions: number;
  currentRecordings: number;
  currentLibraryTracks: number;
  limits: AccessLimits;
  canUpload: boolean;
  canSaveSession: boolean;
  canRecord: boolean;
  canAddLibraryTrack: boolean;
}

export class AccessService {
  private static readonly FREE_LIMITS: AccessLimits = {
    maxUploads: 3,
    maxSessions: 2,
    maxRecordings: 1,
    maxLibraryTracks: 10,
    canDownload: false
  };

  private static readonly PRO_LIMITS: AccessLimits = {
    maxUploads: Infinity,
    maxSessions: Infinity,
    maxRecordings: Infinity,
    maxLibraryTracks: Infinity,
    canDownload: true
  };

  /**
   * Get access limits based on user's tier
   */
  static getLimitsForTier(accessTier: string): AccessLimits {
    return accessTier === 'pro' ? this.PRO_LIMITS : this.FREE_LIMITS;
  }

  /**
   * Get current user's access status
   */
  static async getUserAccessStatus(userId: string, accessTier: string): Promise<AccessStatus> {
    try {
      // Get current counts
      const [uploadsResult, sessionsResult, recordingsResult] = await Promise.all([
        supabase.from('uploads').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('sessions').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('recordings').select('id', { count: 'exact' }).eq('user_id', userId)
      ]);

      const currentUploads = uploadsResult.count || 0;
      const currentSessions = sessionsResult.count || 0;
      const currentRecordings = recordingsResult.count || 0;
      
      // For library tracks, we'll need to track this in localStorage or a separate table
      // For now, we'll use a placeholder - you may want to add a library_usage table
      const currentLibraryTracks = 0; // TODO: Implement actual tracking

      const limits = this.getLimitsForTier(accessTier);

      return {
        currentUploads,
        currentSessions,
        currentRecordings,
        currentLibraryTracks,
        limits,
        canUpload: currentUploads < limits.maxUploads,
        canSaveSession: currentSessions < limits.maxSessions,
        canRecord: currentRecordings < limits.maxRecordings,
        canAddLibraryTrack: currentLibraryTracks < limits.maxLibraryTracks
      };
    } catch (error) {
      console.error('Error getting user access status:', error);
      // Return restrictive defaults on error
      return {
        currentUploads: 0,
        currentSessions: 0,
        currentRecordings: 0,
        currentLibraryTracks: 0,
        limits: this.FREE_LIMITS,
        canUpload: false,
        canSaveSession: false,
        canRecord: false,
        canAddLibraryTrack: false
      };
    }
  }

  /**
   * Get the number of library tracks to show to a user based on their tier
   */
  static getLibraryTracksToShow(accessTier: string, totalTracks: number): number {
    const limits = this.getLimitsForTier(accessTier);
    return accessTier === 'pro' ? totalTracks : Math.min(limits.maxLibraryTracks, totalTracks);
  }

  /**
   * Check if user can perform a specific action
   */
  static async canPerformAction(
    userId: string, 
    accessTier: string, 
    action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'
  ): Promise<boolean> {
    const limits = this.getLimitsForTier(accessTier);

    switch (action) {
      case 'add_library_track':
        // TODO: Implement actual library track counting
        // For now, return true for pro users, false for free users
        return accessTier === 'pro';
      
      case 'download':
        return limits.canDownload;
      
      case 'upload':
        const uploadsResult = await supabase
          .from('uploads')
          .select('id', { count: 'exact' })
          .eq('user_id', userId);
        return (uploadsResult.count || 0) < limits.maxUploads;
      
      case 'save_session':
        const sessionsResult = await supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('user_id', userId);
        return (sessionsResult.count || 0) < limits.maxSessions;
      
      case 'record':
        const recordingsResult = await supabase
          .from('recordings')
          .select('id', { count: 'exact' })
          .eq('user_id', userId);
        return (recordingsResult.count || 0) < limits.maxRecordings;
      
      default:
        return false;
    }
  }

  /**
   * Get upgrade prompt message for a specific action
   */
  static getUpgradeMessage(action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'): string {
    const baseMessage = "Upgrade to Pro Creator to unlock this feature.";
    
    switch (action) {
      case 'upload':
        return "You've reached your upload limit (3 tracks). " + baseMessage;
      case 'save_session':
        return "You've reached your session limit (2 sessions). " + baseMessage;
      case 'record':
        return "You've reached your recording limit (1 recording). " + baseMessage;
      case 'add_library_track':
        return "You've reached your library track limit (10 tracks). " + baseMessage;
      case 'download':
        return "Download your recordings with Pro Creator. " + baseMessage;
      default:
        return baseMessage;
    }
  }
}