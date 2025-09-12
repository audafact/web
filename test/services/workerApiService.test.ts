import { describe, it, expect, vi, beforeEach } from "vitest";
import { signFile } from "../../src/lib/api";

// Note: fetch and Supabase are already mocked globally in setup.ts

describe("Worker API Integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Explicitly setup Supabase mock for each test
    const { supabase } = await import("../../src/services/supabase");
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
  });

  describe("signFile", () => {
    it("should sign file successfully with valid JWT", async () => {
      // Supabase is already mocked globally in setup.ts

      // Mock successful Worker API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://media.audafact.com/signed-url-123",
        }),
      });

      const result = await signFile("library/originals/test-track.mp3");

      expect(result).toBe("https://media.audafact.com/signed-url-123");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/sign-file?key=library%2Foriginals%2Ftest-track.mp3",
        {
          headers: { Authorization: "Bearer test-token" },
        }
      );
    });

    it("should handle authentication errors", async () => {
      // Mock Supabase session without token for this test
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValueOnce({
        data: { session: null },
      });

      await expect(
        signFile("library/originals/test-track.mp3")
      ).rejects.toThrow("Not signed in");
    });

    it("should handle Worker API errors", async () => {
      // Mock Supabase session
      // Supabase is already mocked globally in setup.ts

      // Mock Worker API error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      await expect(
        signFile("library/originals/test-track.mp3")
      ).rejects.toThrow("sign-file failed: 403");
    });

    it("should handle network errors", async () => {
      // Mock Supabase session
      // Supabase is already mocked globally in setup.ts

      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(
        signFile("library/originals/test-track.mp3")
      ).rejects.toThrow("Network error");
    });

    it("should handle invalid response format", async () => {
      // Mock Supabase session
      // Supabase is already mocked globally in setup.ts

      // Mock invalid response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      const result = await signFile("library/originals/test-track.mp3");
      expect(result).toBeUndefined();
    });
  });

  describe("File Key Validation", () => {
    it("should handle different file key formats", async () => {
      // Supabase is already mocked globally in setup.ts

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://example.com/signed-url" }),
      });

      // Test library tracks
      await signFile("library/originals/track-123.mp3");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("library%2Foriginals%2Ftrack-123.mp3"),
        expect.any(Object)
      );

      // Test user uploads
      await signFile("users/user-123/uploads/file-456.wav");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("users%2Fuser-123%2Fuploads%2Ffile-456.wav"),
        expect.any(Object)
      );

      // Test session recordings
      await signFile("sessions/session-789/recording-101.mp3");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("sessions%2Fsession-789%2Frecording-101.mp3"),
        expect.any(Object)
      );
    });
  });
});
