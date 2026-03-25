/**
 * Single source of truth for Audafact Sampler tier limits and feature flags.
 * Guest / Free / Starter / Pro per access-control PRD.
 */
import type { FeatureAccess, UsageLimits } from "../types/music";

export type DbAccessTier = "free" | "starter" | "pro" | "enterprise";

/**
 * Public catalog size (active library rows). Update when adding/removing `library_tracks` seeds.
 * Used for UI copy; enforcement is in `get_user_tracks` RPC.
 */
export const LIBRARY_CATALOG_TOTAL_ACTIVE = 59;

/** Max catalog tracks visible per app tier (guest = bundled demo only). */
export const LIBRARY_TIER_VISIBLE_CAPS = {
  guest: 4,
  free: 15,
  starter: 35,
  pro: LIBRARY_CATALOG_TOTAL_ACTIVE,
} as const;

export function getLibraryVisibleCapForAppTier(
  tierId: string
): number {
  switch (tierId) {
    case "guest":
      return LIBRARY_TIER_VISIBLE_CAPS.guest;
    case "starter":
      return LIBRARY_TIER_VISIBLE_CAPS.starter;
    case "pro":
      return LIBRARY_TIER_VISIBLE_CAPS.pro;
    case "free":
    default:
      return LIBRARY_TIER_VISIBLE_CAPS.free;
  }
}

/** Short message for the library sidebar (authenticated users). */
export function getLibraryCatalogBannerText(params: {
  tierId: string;
  tierName: string;
  visibleCount: number;
}): string {
  const { tierId, tierName, visibleCount } = params;
  if (tierId === "guest") {
    return `You're previewing ${LIBRARY_TIER_VISIBLE_CAPS.guest} demo tracks. Create a free account for a larger curated selection from the catalog.`;
  }
  if (tierId === "pro") {
    return `You have full catalog access on ${tierName} (~${LIBRARY_CATALOG_TOTAL_ACTIVE} tracks).`;
  }
  const cap = getLibraryVisibleCapForAppTier(tierId);
  return `You're browsing ${visibleCount} of ~${LIBRARY_CATALOG_TOTAL_ACTIVE} catalog tracks on ${tierName} (up to ${cap} on your plan). Upgrade to unlock more variety and Pro-only cuts.`;
}

export const GUEST_FEATURES: FeatureAccess = {
  canUpload: false,
  canSaveSession: false,
  canRecord: false,
  canDownload: false,
  canExportMp3: false,
  canExportWav: false,
  canEditCues: false,
  canEditLoops: false,
  canBrowseLibrary: true,
  canAccessProTracks: false,
};

export const FREE_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: true,
  canDownload: true,
  canExportMp3: true,
  canExportWav: false,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: false,
};

/** Same export/trigger rules as Free; higher quotas */
export const STARTER_FEATURES: FeatureAccess = { ...FREE_FEATURES };

export const PRO_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: true,
  canDownload: true,
  canExportMp3: true,
  canExportWav: true,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: true,
};

export const GUEST_LIMITS: UsageLimits = {
  maxUploads: 0,
  maxSessions: 0,
  maxRecordings: 0,
  maxLibraryTracks: LIBRARY_TIER_VISIBLE_CAPS.guest,
};

/** PRD: 5 uploads, 3 sessions, 2 recordings */
export const FREE_LIMITS: UsageLimits = {
  maxUploads: 5,
  maxSessions: 3,
  maxRecordings: 2,
  maxLibraryTracks: LIBRARY_TIER_VISIBLE_CAPS.free,
};

/** PRD: 10–15 uploads, 5–10 sessions, expanded recordings */
export const STARTER_LIMITS: UsageLimits = {
  maxUploads: 12,
  maxSessions: 8,
  maxRecordings: 8,
  maxLibraryTracks: LIBRARY_TIER_VISIBLE_CAPS.starter,
};

export const PRO_LIMITS: UsageLimits = {
  maxUploads: Infinity,
  maxSessions: Infinity,
  maxRecordings: Infinity,
  maxLibraryTracks: Infinity,
};

export interface NumericAccessLimits {
  maxUploads: number;
  maxSessions: number;
  maxRecordings: number;
  maxLibraryTracks: number;
  canDownload: boolean;
}

export function getNumericLimitsForDbTier(accessTier: string): NumericAccessLimits {
  switch (accessTier) {
    case "pro":
      return {
        maxUploads: PRO_LIMITS.maxUploads,
        maxSessions: PRO_LIMITS.maxSessions,
        maxRecordings: PRO_LIMITS.maxRecordings,
        maxLibraryTracks: PRO_LIMITS.maxLibraryTracks,
        canDownload: true,
      };
    case "starter":
      return {
        maxUploads: STARTER_LIMITS.maxUploads,
        maxSessions: STARTER_LIMITS.maxSessions,
        maxRecordings: STARTER_LIMITS.maxRecordings,
        maxLibraryTracks: STARTER_LIMITS.maxLibraryTracks,
        canDownload: true,
      };
    default:
      return {
        maxUploads: FREE_LIMITS.maxUploads,
        maxSessions: FREE_LIMITS.maxSessions,
        maxRecordings: FREE_LIMITS.maxRecordings,
        maxLibraryTracks: FREE_LIMITS.maxLibraryTracks,
        canDownload: false,
      };
  }
}

/** Guest-only gate: Hold / One-Shot trigger styles require a free account */
export function canUseAdvancedTriggerStyles(tierId: string): boolean {
  return tierId !== "guest";
}

export function canExportWavTier(tierId: string): boolean {
  return tierId === "pro";
}
