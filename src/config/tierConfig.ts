/**
 * Single source of truth for Audafact Sampler tier limits and feature flags.
 * Guest / Free / Starter / Pro per access-control PRD.
 */
import type { FeatureAccess, UsageLimits } from "../types/music";

export type DbAccessTier = "free" | "starter" | "pro" | "enterprise";

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
  maxLibraryTracks: 10,
};

/** PRD: 5 uploads, 3 sessions, 2 recordings */
export const FREE_LIMITS: UsageLimits = {
  maxUploads: 5,
  maxSessions: 3,
  maxRecordings: 2,
  maxLibraryTracks: 10,
};

/** PRD: 10–15 uploads, 5–10 sessions, expanded recordings */
export const STARTER_LIMITS: UsageLimits = {
  maxUploads: 12,
  maxSessions: 8,
  maxRecordings: 8,
  maxLibraryTracks: 10_000,
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

/** Pro-only: Hold / One-Shot trigger styles */
export function canUseAdvancedTriggerStyles(tierId: string): boolean {
  return tierId === "pro";
}

export function canExportWavTier(tierId: string): boolean {
  return tierId === "pro";
}
