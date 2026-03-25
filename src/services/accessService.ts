import { supabase } from './supabase';
import { UserTier, FeatureGateConfig } from '../types/music';
import {
  getNumericLimitsForDbTier,
  getLibraryVisibleCapForAppTier,
} from '../config/tierConfig';

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
  /**
   * Get access limits based on DB access_tier (free | starter | pro | enterprise)
   */
  static getLimitsForTier(accessTier: string): AccessLimits {
    const t = (accessTier || 'free').toLowerCase();
    if (t === 'enterprise') return getNumericLimitsForDbTier('pro');
    return getNumericLimitsForDbTier(t === 'starter' ? 'starter' : t === 'pro' ? 'pro' : 'free');
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
      
      // Get current library track count from database
      const currentLibraryTracks = await this.getUserLibraryTrackCount(userId);

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
        limits: getNumericLimitsForDbTier('free'),
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
    const t = (accessTier || 'free').toLowerCase();
    const appTier =
      t === 'enterprise' || t === 'pro'
        ? 'pro'
        : t === 'starter'
          ? 'starter'
          : 'free';
    const cap = getLibraryVisibleCapForAppTier(appTier);
    return Math.min(cap, totalTracks);
  }

  /**
   * Check if user can perform a specific action
   */
  static async canPerformAction(
    userId: string, 
    accessTier: string, 
    action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download' | 'download_mp3' | 'download_wav'
  ): Promise<boolean> {
    const limits = this.getLimitsForTier(accessTier);

    switch (action) {
      case 'add_library_track':
        // Free users can add any of the 10 available library tracks to their studio
        // The limit is on library availability, not studio usage
        return accessTier !== 'guest'; // Only guests are blocked from adding tracks
      
      case 'download':
        return limits.canDownload;
      
      case 'download_mp3':
        return accessTier !== 'guest'; // Free and Pro can export MP3
      case 'download_wav':
        return accessTier === 'pro' || accessTier === 'enterprise'; // WAV: Pro only
      
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
  static getUpgradeMessage(action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download' | 'download_mp3' | 'download_wav'): string {
    switch (action) {
      case 'upload':
        return "You've reached your upload limit. Upgrade to keep creating with more tracks.";
      case 'save_session':
        return "Upgrade to unlock unlimited sessions and advanced performance modes.";
      case 'record':
        return "Upgrade to unlock unlimited sessions and more recordings.";
      case 'add_library_track':
        return "Add samples from the catalog to your studio. Create a free account to start, then upgrade for more tracks and Pro-only cuts.";
      case 'download':
        return "Export your flip to finish your idea — upgrade for full export options.";
      case 'download_mp3':
        return "Create a free account to export your recordings as MP3.";
      case 'download_wav':
        return "Export your track in high-quality WAV for your DAW — unlock with Pro.";
      default:
        return "Upgrade to unlock this feature.";
    }
  }

  /**
   * Get the number of library tracks a user has added to their studio
   * Note: This is no longer needed since we don't limit studio usage
   */
  private static async getUserLibraryTrackCount(userId: string): Promise<number> {
    // No longer tracking individual user library usage
    return 0;
  }

  /**
   * Add a library track to user's collection
   * Note: This is no longer needed since we don't limit studio usage
   */
  static async addLibraryTrackToUser(userId: string, trackId: string): Promise<boolean> {
    // No longer tracking individual user library usage
    return true;
  }

  /**
   * Remove a library track from user's collection
   * Note: This is no longer needed since we don't limit studio usage
   */
  static async removeLibraryTrackFromUser(userId: string, trackId: string): Promise<boolean> {
    // No longer tracking individual user library usage
    return true;
  }

  /**
   * Get user's current library tracks
   * Note: This is no longer needed since we don't limit studio usage
   */
  static async getUserLibraryTracks(userId: string): Promise<any[]> {
    // No longer tracking individual user library usage
    return [];
  }

  /**
   * Get rotation information
   */
  static async getRotationInfo(): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_rotation_info');
      
      if (error) {
        console.error('Error getting rotation info:', error);
        return null;
      }
      
      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting rotation info:', error);
      return null;
    }
  }
}

export class EnhancedAccessService extends AccessService {
  static canAccessFeature(feature: string, tier: UserTier): boolean {
    const featureAccess: Record<string, boolean> = {
      upload: tier.features.canUpload,
      save_session: tier.features.canSaveSession,
      record: tier.features.canRecord,
      download: tier.features.canDownload,
      download_mp3: tier.features.canExportMp3,
      download_wav: tier.features.canExportWav,
      edit_cues: tier.features.canEditCues,
      edit_loops: tier.features.canEditLoops,
      browse_library: tier.features.canBrowseLibrary,
      access_pro_tracks: tier.features.canAccessProTracks
    };
    
    return featureAccess[feature] || false;
  }
  
  static getFeatureGateConfig(feature: string, tier?: UserTier): FeatureGateConfig {
    const atLimit =
      tier?.id === 'free' || tier?.id === 'starter';
    const configs: Record<string, FeatureGateConfig> = {
      upload: {
        gateType: 'modal',
        message: "Create a free account to upload your own tracks and keep creating.",
        ctaText: "Create free account",
        upgradeRequired: false
      },
      save_session: {
        gateType: 'modal',
        message: "Create a free account to keep your work.",
        ctaText: "Create free account",
        upgradeRequired: false
      },
      add_second_source: {
        gateType: 'modal',
        message: "Create a free account to add more tracks and keep your work.",
        ctaText: "Create free account",
        upgradeRequired: false
      },
      record: {
        gateType: 'modal',
        message:
          tier?.id === 'guest'
            ? "Record your performance by creating a free account."
            : atLimit
              ? "Upgrade to unlock unlimited sessions and more recordings."
              : "Record and export your performances.",
        ctaText:
          tier?.id === 'guest' ? "Create free account" : "View plans",
        upgradeRequired: tier?.id !== 'guest'
      },
      download: {
        gateType: 'modal',
        message: "Export your flip to finish your idea.",
        ctaText: "View plans",
        upgradeRequired: true
      },
      download_mp3: {
        gateType: 'modal',
        message: "Create a free account to export your recordings as MP3.",
        ctaText: "Create free account",
        upgradeRequired: false
      },
      download_wav: {
        gateType: 'modal',
        message: "Unlock expressive performance and production control — export WAV with Pro.",
        ctaText: "Upgrade to Pro",
        upgradeRequired: true
      },
      edit_cues: {
        gateType: 'tooltip',
        message: "Sign up to customize cue points",
        ctaText: "Sign up now",
        upgradeRequired: false
      },
      edit_loops: {
        gateType: 'tooltip',
        message: "Sign up to set custom loops",
        ctaText: "Sign up now",
        upgradeRequired: false
      }
    };
    
    return configs[feature] || {
      gateType: 'modal',
      message: "Upgrade to unlock this feature",
      ctaText: "Upgrade now",
      upgradeRequired: true
    };
  }
  
  static async checkUsageLimits(userId: string, tier: UserTier, action: string): Promise<boolean> {
    if (tier.id === 'pro') return true; // No limits for pro users
    
    const limits = tier.limits;
    
    switch (action) {
      case 'upload':
        const uploadCount = await this.getUserUploadCount(userId);
        return uploadCount < limits.maxUploads;
      
      case 'save_session':
        const sessionCount = await this.getUserSessionCount(userId);
        return sessionCount < limits.maxSessions;
      
      case 'record':
        const recordingCount = await this.getUserRecordingCount(userId);
        return recordingCount < limits.maxRecordings;
      
      default:
        return true;
    }
  }

  private static async getUserUploadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('uploads')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    return count || 0;
  }

  private static async getUserSessionCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    return count || 0;
  }

  private static async getUserRecordingCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('recordings')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    return count || 0;
  }
}