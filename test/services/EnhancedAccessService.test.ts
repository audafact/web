import { describe, it, expect, vi } from "vitest";
import { EnhancedAccessService } from "../../src/services/accessService";
import { UserTier } from "../../src/types/music";

// Supabase is mocked globally in setup.ts

describe("EnhancedAccessService", () => {
  const mockProTier: UserTier = {
    id: "pro",
    name: "Pro Creator",
    features: {
      canUpload: true,
      canSaveSession: true,
      canRecord: true,
      canDownload: true,
      canEditCues: true,
      canEditLoops: true,
      canBrowseLibrary: true,
      canAccessProTracks: true,
    },
    limits: {
      maxUploads: Infinity,
      maxSessions: Infinity,
      maxRecordings: Infinity,
      maxLibraryTracks: Infinity,
    },
  };

  const mockFreeTier: UserTier = {
    id: "free",
    name: "Free Creator",
    features: {
      canUpload: true,
      canSaveSession: true,
      canRecord: true,
      canDownload: false,
      canEditCues: true,
      canEditLoops: true,
      canBrowseLibrary: true,
      canAccessProTracks: false,
    },
    limits: {
      maxUploads: 5,
      maxSessions: 10,
      maxRecordings: 1,
      maxLibraryTracks: 20,
    },
  };

  const mockGuestTier: UserTier = {
    id: "guest",
    name: "Guest",
    features: {
      canUpload: false,
      canSaveSession: false,
      canRecord: false,
      canDownload: false,
      canEditCues: false,
      canEditLoops: false,
      canBrowseLibrary: true,
      canAccessProTracks: false,
    },
    limits: {
      maxUploads: 0,
      maxSessions: 0,
      maxRecordings: 0,
      maxLibraryTracks: 5,
    },
  };

  describe("canAccessFeature", () => {
    it("should allow pro users to access all features", () => {
      expect(
        EnhancedAccessService.canAccessFeature("upload", mockProTier)
      ).toBe(true);
      expect(
        EnhancedAccessService.canAccessFeature("record", mockProTier)
      ).toBe(true);
      expect(
        EnhancedAccessService.canAccessFeature("download", mockProTier)
      ).toBe(true);
      expect(
        EnhancedAccessService.canAccessFeature("edit_cues", mockProTier)
      ).toBe(true);
    });

    it("should restrict guest users appropriately", () => {
      expect(
        EnhancedAccessService.canAccessFeature("upload", mockGuestTier)
      ).toBe(false);
      expect(
        EnhancedAccessService.canAccessFeature("record", mockGuestTier)
      ).toBe(false);
      expect(
        EnhancedAccessService.canAccessFeature("download", mockGuestTier)
      ).toBe(false);
      expect(
        EnhancedAccessService.canAccessFeature("browse_library", mockGuestTier)
      ).toBe(true);
    });

    it("should allow free users to access recording", () => {
      expect(
        EnhancedAccessService.canAccessFeature("upload", mockFreeTier)
      ).toBe(true);
      expect(
        EnhancedAccessService.canAccessFeature("record", mockFreeTier)
      ).toBe(true);
      expect(
        EnhancedAccessService.canAccessFeature("download", mockFreeTier)
      ).toBe(false);
      expect(
        EnhancedAccessService.canAccessFeature("edit_cues", mockFreeTier)
      ).toBe(true);
    });

    it("should return false for unknown features", () => {
      expect(
        EnhancedAccessService.canAccessFeature("unknown_feature", mockProTier)
      ).toBe(false);
    });
  });

  describe("getFeatureGateConfig", () => {
    it("should return correct config for upload feature", () => {
      const config = EnhancedAccessService.getFeatureGateConfig("upload");
      expect(config.gateType).toBe("modal");
      expect(config.message).toContain("remix your own sounds");
      expect(config.ctaText).toBe("Sign up to upload tracks");
    });

    it("should return correct config for record feature", () => {
      const config = EnhancedAccessService.getFeatureGateConfig("record");
      expect(config.gateType).toBe("modal");
      expect(config.message).toContain("Record and export");
      expect(config.ctaText).toBe("Upgrade to Pro Creator");
    });

    it("should return tier-specific config for record feature", () => {
      const freeConfig = EnhancedAccessService.getFeatureGateConfig(
        "record",
        mockFreeTier
      );
      const guestConfig = EnhancedAccessService.getFeatureGateConfig(
        "record",
        mockGuestTier
      );

      expect(freeConfig.message).toContain("free recording");
      expect(guestConfig.message).toContain("Record and export");
    });

    it("should return correct config for edit_cues feature", () => {
      const config = EnhancedAccessService.getFeatureGateConfig("edit_cues");
      expect(config.gateType).toBe("tooltip");
      expect(config.message).toContain("customize cue points");
    });

    it("should return default config for unknown features", () => {
      const config =
        EnhancedAccessService.getFeatureGateConfig("unknown_feature");
      expect(config.gateType).toBe("modal");
      expect(config.message).toContain("feature");
    });
  });

  describe("checkUsageLimits", () => {
    it("should always return true for pro users", async () => {
      const result = await EnhancedAccessService.checkUsageLimits(
        "user123",
        mockProTier,
        "upload"
      );
      expect(result).toBe(true);
    });

    it("should check upload limits for free users", async () => {
      // Mock the supabase response
      const { supabase } = await import("../../src/services/supabase");
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 3,
            error: null,
          }),
        }),
      });

      const result = await EnhancedAccessService.checkUsageLimits(
        "user123",
        mockFreeTier,
        "upload"
      );
      expect(result).toBe(true);
    });

    it("should deny when limits are exceeded", async () => {
      // Mock the supabase response
      const { supabase } = await import("../../src/services/supabase");
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 10, // Exceeds limit of 5
            error: null,
          }),
        }),
      });

      const result = await EnhancedAccessService.checkUsageLimits(
        "user123",
        mockFreeTier,
        "upload"
      );
      expect(result).toBe(false);
    });
  });
});
