// services/libraryService.ts
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
   * Free/guest: RPC get_free_user_tracks
   * Pro: RPC get_pro_user_tracks
   */
  static async getLibraryTracks(
    userTier: "guest" | "free" | "pro"
  ): Promise<LibraryTrack[]> {
    try {
      if (userTier === "pro") {
        const { data, error } = await supabase.rpc("get_pro_user_tracks");
        if (error) throw error;
        return this.transformDatabaseTracks(
          (data ?? []) as DatabaseLibraryTrack[]
        );
      }

      // guest and free use the free RPC
      const { data, error } = await supabase.rpc("get_free_user_tracks");
      if (error) throw error;
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
    const tracks = await this.getLibraryTracks(userTier);
    return tracks.filter((t) => t.genre === genre);
  }

  /** Available genres for tier */
  static async getAvailableGenres(
    userTier: "guest" | "free" | "pro"
  ): Promise<string[]> {
    const tracks = await this.getLibraryTracks(userTier);
    return [...new Set(tracks.map((t) => t.genre))];
  }

  /** Get a single track by id (track_id) */
  static async getTrackById(
    trackId: string,
    userTier: "guest" | "free" | "pro"
  ): Promise<LibraryTrack | null> {
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
      };
    });
  }

  /**
   * Count tracks for tier (client side)
   */
  static async getTrackCount(
    userTier: "guest" | "free" | "pro"
  ): Promise<number> {
    const tracks = await this.getLibraryTracks(userTier);
    return tracks.length;
  }
}

/** Optional helper if you want to choose preview vs original by tier at call sites */
export function pickPlayableKey(
  t: LibraryTrack,
  userTier: "guest" | "free" | "pro"
): string {
  if ((userTier === "guest" || userTier === "free") && t.previewKey) {
    return t.previewKey;
  }
  return t.fileKey;
}
