// services/libraryService.ts
//
// NOTE: This service now provides business logic for library tracks.
// Data fetching is handled by the useUser hook.
// - Guest users: No tracks (bundled tracks via DemoProvider)
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
   * Transform database tracks to app tracks.
   * IMPORTANT: we return keys (fileKey/previewKey) not public URLs.
   */
  static transformDatabaseTracks(
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

  /** Transform LibraryTrack[] to AudioAsset[] for Studio component */
  static transformToAudioAssets(tracks: LibraryTrack[]): Array<{
    id: string;
    name: string;
    fileKey: string;
    type: "wav" | "mp3";
    size: string;
    is_demo: boolean;
  }> {
    return tracks.map((t) => ({
      id: t.id,
      name: t.name,
      fileKey: t.fileKey,
      type: t.type,
      size: t.size,
      is_demo: false,
    }));
  }

  /** Get tracks by genre (client-side filter) */
  static filterByGenre(tracks: LibraryTrack[], genre: string): LibraryTrack[] {
    return tracks.filter((t) => t.genre === genre);
  }

  /** Available genres from tracks */
  static getAvailableGenres(tracks: LibraryTrack[]): string[] {
    return [...new Set(tracks.map((t) => t.genre))];
  }

  /** Get a single track by id (track_id) */
  static getTrackById(
    tracks: LibraryTrack[],
    trackId: string
  ): LibraryTrack | null {
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
   * Count tracks (client side)
   */
  static getTrackCount(tracks: LibraryTrack[]): number {
    return tracks.length;
  }

  /**
   * Choose preview vs original by tier at call sites
   */
  static pickPlayableKey(
    track: LibraryTrack,
    userTier: "guest" | "free" | "pro"
  ): string {
    // Guest users don't have database tracks, so this function is mainly for free/pro users
    if ((userTier === "guest" || userTier === "free") && track.previewKey) {
      return track.previewKey;
    }
    return track.fileKey;
  }
}

/** Export the helper function for backward compatibility */
export function pickPlayableKey(
  t: LibraryTrack,
  userTier: "guest" | "free" | "pro"
): string {
  return LibraryService.pickPlayableKey(t, userTier);
}
