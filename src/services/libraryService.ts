// services/libraryService.ts
//
// NOTE: This service now provides database tracks based on user tier:
// - Guest users: No tracks (bundled tracks via GuestContext)
// - Free users: 10 monthly revolving tracks from library_tracks
// - Pro users: All available tracks from library_tracks
//
import { supabase } from "./supabase";
import { LibraryTrack } from "../types/music";
import { normalizeLegacyUrlToKey } from "@/utils/media";

/** DB row shape (reflects your table incl. new key columns) */
export interface DatabaseLibraryTrack {
  id: string;
  track_id: string;
  name: string;
  artist: string | null;
  genre: string;
  bpm: number | null;
  key: string | null;
  duration: number | null;

  // legacy URL columns (kept for fallback)
  file_url: string;
  preview_url: string | null;

  // NEW: object keys in R2 (preferred)
  file_key: string;
  preview_key: string | null;

  type: "wav" | "mp3";
  size: string | null;

  // optional metadata
  content_hash?: string | null;
  size_bytes?: number | null;
  content_type?: string | null;

  tags: string[];
  is_pro_only: boolean;
  rotation_week: number | null;
  is_active?: boolean;
}

export class LibraryService {
  /**
   * Get library tracks based on user tier.
   * Guest: No tracks (bundled tracks via GuestContext)
   * Free: 10 monthly revolving tracks via get_user_tracks RPC
   * Pro: All tracks via get_user_tracks RPC
   */
  static async getLibraryTracks(
    userTier: "guest" | "free" | "pro"
  ): Promise<LibraryTrack[]> {
    try {
      if (userTier === "guest") {
        // Guest users don't get database tracks - they use bundled tracks
        console.log(
          "Guest user: No database tracks needed (bundled tracks via GuestContext)"
        );
        return [];
      }

      // Free and Pro users get tracks via RPC function
      const { data, error } = await supabase.rpc("get_user_tracks");
      if (error) {
        console.error("Error calling get_user_tracks RPC:", error);
        throw error;
      }

      return this.transformDatabaseTracks(
        (data ?? []) as DatabaseLibraryTrack[]
      );
    } catch (error) {
      console.error("Error fetching library tracks:", error);
      return [];
    }
  }

  /** Get tracks by genre (client-side filter on the set for the tier) */
  static async getTracksByGenre(
    genre: string,
    userTier: "guest" | "free" | "pro"
  ): Promise<LibraryTrack[]> {
    // Guest users don't have database tracks to filter
    if (userTier === "guest") {
      return [];
    }

    const tracks = await this.getLibraryTracks(userTier);
    return tracks.filter((t) => t.genre === genre);
  }

  /** Available genres for tier */
  static async getAvailableGenres(
    userTier: "guest" | "free" | "pro"
  ): Promise<string[]> {
    // Guest users don't have database tracks to get genres from
    if (userTier === "guest") {
      return [];
    }

    const tracks = await this.getLibraryTracks(userTier);
    return [...new Set(tracks.map((t) => t.genre))];
  }

  /** Get a single track by id (track_id) */
  static async getTrackById(
    trackId: string,
    userTier: "guest" | "free" | "pro"
  ): Promise<LibraryTrack | null> {
    // Guest users don't have database tracks to search
    if (userTier === "guest") {
      return null;
    }

    const tracks = await this.getLibraryTracks(userTier);
    return tracks.find((t) => t.id === trackId) ?? null;
  }

  /** Rotation week info via RPC */
  static async getCurrentRotationInfo(): Promise<{
    weekNumber: number;
    trackCount: number;
    nextRotationDate: string;
    daysUntilRotation: number;
  }> {
    try {
      const { data, error } = await supabase.rpc("get_rotation_info");
      if (error) throw error;
      if (data && data.length > 0) {
        const info = data[0] as any;
        return {
          weekNumber: info.current_week,
          trackCount: info.current_track_count,
          nextRotationDate: info.next_rotation_date,
          daysUntilRotation: info.days_until_rotation,
        };
      }
      return {
        weekNumber: 1,
        trackCount: 0,
        nextRotationDate: "",
        daysUntilRotation: 0,
      };
    } catch (error) {
      console.error("Error getting rotation info:", error);
      return {
        weekNumber: 1,
        trackCount: 0,
        nextRotationDate: "",
        daysUntilRotation: 0,
      };
    }
  }

  /**
   * Transform DB rows → app tracks.
   * IMPORTANT: we return keys (fileKey/previewKey) not public URLs.
   */
  private static transformDatabaseTracks(
    dbTracks: DatabaseLibraryTrack[]
  ): LibraryTrack[] {
    return dbTracks.map((t) => {
      const fileKey =
        t.file_key && t.file_key.length > 0
          ? t.file_key
          : normalizeLegacyUrlToKey(t.file_url, { isPreview: false });

      const previewKey =
        t.preview_key && t.preview_key.length > 0
          ? t.preview_key
          : t.preview_url
          ? normalizeLegacyUrlToKey(t.preview_url, { isPreview: true })
          : undefined;

      return {
        id: t.track_id,
        name: t.name,
        artist: t.artist ?? undefined,
        genre: t.genre,
        bpm: t.bpm ?? 0,
        key: t.key ?? undefined,
        duration: t.duration ?? 0,
        fileKey,
        previewKey,
        type: t.type,
        size: t.size ?? "Unknown",
        tags: t.tags,
        isProOnly: t.is_pro_only,
        previewUrl: t.preview_url ?? undefined,
        rotationWeek: t.rotation_week ?? undefined,
        isActive: t.is_active ?? undefined,
        isDemo: false, // Default to false since is_demo doesn't exist in DatabaseLibraryTrack
      };
    });
  }

  /**
   * Count tracks for tier (client side)
   */
  static async getTrackCount(
    userTier: "guest" | "free" | "pro"
  ): Promise<number> {
    // Guest users don't have database tracks to count
    if (userTier === "guest") {
      return 0;
    }

    const tracks = await this.getLibraryTracks(userTier);
    return tracks.length;
  }

  /**
   * Get user's current tier (placeholder - should integrate with subscription service)
   */
  static async getUserTier(userId: string): Promise<"guest" | "free" | "pro"> {
    try {
      // TODO: This should integrate with your subscription service
      // For now, return 'free' for all authenticated users
      return "free";
    } catch (error) {
      console.error("Error getting user tier:", error);
      return "free";
    }
  }
}

/** Optional helper if you want to choose preview vs original by tier at call sites */
export function pickPlayableKey(
  t: LibraryTrack,
  userTier: "guest" | "free" | "pro"
): string {
  // Guest users don't have database tracks, so this function is mainly for free/pro users
  if ((userTier === "guest" || userTier === "free") && t.previewKey) {
    return t.previewKey;
  }
  return t.fileKey;
}
