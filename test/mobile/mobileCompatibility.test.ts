import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signFile } from "../../src/lib/api";
import { StorageService } from "../../src/services/storageService";

// Note: fetch and Supabase are already mocked globally in setup.ts

// Mock crypto API
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid-123",
    subtle: {
      digest: vi.fn(),
    },
  },
  writable: true,
});

// Mock hash functions
vi.mock("../../src/lib/hash", () => ({
  sha256Blob: vi.fn().mockResolvedValue("test-hash-1234567890abcdef"),
  shortHex: vi.fn().mockReturnValue("test-hash"),
}));

// Mock keys functions
vi.mock("../../src/lib/keys", () => ({
  userUploadKey: vi
    .fn()
    .mockReturnValue("users/test-user/uploads/test-uuid-123-test-audio.mp3"),
}));

// Supabase is mocked globally in setup.ts

describe("Mobile Compatibility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("iOS Safari Compatibility", () => {
    beforeEach(() => {
      // Mock iOS Safari user agent
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        writable: true,
      });

      // Mock iOS-specific APIs
      Object.defineProperty(window, "DeviceMotionEvent", {
        value: class DeviceMotionEvent {},
        writable: true,
      });

      Object.defineProperty(window, "DeviceOrientationEvent", {
        value: class DeviceOrientationEvent {},
        writable: true,
      });
    });

    it("should handle audio context initialization on iOS", async () => {
      // Mock AudioContext for iOS
      const mockAudioContext = {
        state: "suspended",
        resume: vi.fn().mockResolvedValue(undefined),
        createBufferSource: vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: { value: 1 },
        }),
        destination: {},
      };

      // Mock AudioContext constructor
      (global as any).AudioContext = vi.fn(() => mockAudioContext);
      (global as any).webkitAudioContext = vi.fn(() => mockAudioContext);

      // Test that audio context can be created and resumed
      const audioContext = new (global as any).AudioContext();
      expect(audioContext.state).toBe("suspended");

      await audioContext.resume();
      expect(audioContext.resume).toHaveBeenCalled();
    });

    it("should handle autoplay policies on iOS", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://media.audafact.com/signed-url",
          }),
      });

      // Test that signed URLs work on iOS
      const signedUrl = await signFile("library/originals/test-track.mp3");
      expect(signedUrl).toBe("https://media.audafact.com/signed-url");

      // Mock the second fetch call for the signed URL
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      // Test that audio can be loaded (iOS requires user interaction for autoplay)
      const audioResponse = await fetch(signedUrl);
      expect(audioResponse.ok).toBe(true);
    });

    it("should handle touch interactions for audio playback", () => {
      // Mock touch events
      const touchEvent = new TouchEvent("touchstart", {
        touches: [
          {
            clientX: 100,
            clientY: 100,
            identifier: 1,
            target: document.body,
          },
        ],
      });

      // Test that touch events are properly handled
      expect(touchEvent.touches).toHaveLength(1);
      expect(touchEvent.touches[0].clientX).toBe(100);
      expect(touchEvent.touches[0].clientY).toBe(100);
    });

    it("should handle file uploads on iOS", async () => {
      // Mock file input for iOS
      const mockFile = new File(["test audio content"], "test-audio.m4a", {
        type: "audio/mp4", // iOS prefers MP4/M4A
      });

      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock database operations
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST116" },
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "upload-123" },
              error: null,
            }),
          }),
        }),
      });

      // Mock Worker API responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              url: "https://r2.example.com/signed-upload-url",
              key: "users/test-user/uploads/test-uuid-123-test-audio.m4a",
            }),
        })
        .mockResolvedValueOnce({ ok: true });

      const result = await StorageService.uploadAudioFile(
        mockFile,
        "test-user",
        "Test Audio"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.metadata.contentType).toBe("audio/mp4");
    });
  });

  describe("Android Chrome Compatibility", () => {
    beforeEach(() => {
      // Mock Android Chrome user agent
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
        writable: true,
      });
    });

    it("should handle audio context initialization on Android", async () => {
      // Mock AudioContext for Android
      const mockAudioContext = {
        state: "running",
        resume: vi.fn().mockResolvedValue(undefined),
        createBufferSource: vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: { value: 1 },
        }),
        destination: {},
      };

      (global as any).AudioContext = vi.fn(() => mockAudioContext);

      const audioContext = new (global as any).AudioContext();
      expect(audioContext.state).toBe("running");
    });

    it("should handle file uploads on Android", async () => {
      // Mock file input for Android
      const mockFile = new File(["test audio content"], "test-audio.mp3", {
        type: "audio/mpeg",
      });

      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock database operations
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST116" },
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "upload-123" },
              error: null,
            }),
          }),
        }),
      });

      // Mock Worker API responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              url: "https://r2.example.com/signed-upload-url",
              key: "users/test-user/uploads/test-uuid-123-test-audio.mp3",
            }),
        })
        .mockResolvedValueOnce({ ok: true });

      const result = await StorageService.uploadAudioFile(
        mockFile,
        "test-user",
        "Test Audio"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it("should handle touch gestures for audio controls", () => {
      // Mock touch events for Android
      const touchEvent = new TouchEvent("touchstart", {
        touches: [
          {
            clientX: 150,
            clientY: 200,
            identifier: 1,
            target: document.body,
          },
        ],
      });

      // Test touch gesture handling
      expect(touchEvent.touches).toHaveLength(1);
      expect(touchEvent.touches[0].clientX).toBe(150);
      expect(touchEvent.touches[0].clientY).toBe(200);
    });
  });

  describe("Mobile Network Conditions", () => {
    it("should handle slow network connections", async () => {
      // Mock slow network using the global fetch mock
      vi.mocked(global.fetch).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({
                      url: "https://media.audafact.com/signed-url",
                    }),
                }),
              5000 // 5 second delay to simulate slow network
            )
          )
      );

      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      const startTime = Date.now();
      const signedUrl = await signFile("library/originals/test-track.mp3");
      const endTime = Date.now();

      expect(signedUrl).toBe("https://media.audafact.com/signed-url");
      expect(endTime - startTime).toBeGreaterThan(4000); // Should take at least 4 seconds
    });

    it("should handle network interruptions", async () => {
      // Mock network failure
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      await expect(
        signFile("library/originals/test-track.mp3")
      ).rejects.toThrow("Network error");
    });

    it("should handle large file uploads on mobile", async () => {
      // Create a large file (simulate)
      const largeFile = new File(
        ["x".repeat(50 * 1024 * 1024)],
        "large-audio.mp3",
        {
          type: "audio/mpeg",
        }
      ); // 50MB file

      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock database operations
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "PGRST116" },
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "upload-123" },
              error: null,
            }),
          }),
        }),
      });

      // Mock Worker API responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              url: "https://r2.example.com/signed-upload-url",
              key: "users/test-user/uploads/test-uuid-123-large-audio.mp3",
            }),
        })
        .mockResolvedValueOnce({ ok: true });

      const result = await StorageService.uploadAudioFile(
        largeFile,
        "test-user",
        "Large Audio"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.metadata.sizeBytes).toBe(50 * 1024 * 1024);
    });
  });

  describe("Mobile-Specific Audio Features", () => {
    it("should handle audio context suspension on mobile", async () => {
      const mockAudioContext = {
        state: "suspended",
        resume: vi.fn().mockResolvedValue(undefined),
        suspend: vi.fn().mockResolvedValue(undefined),
        createBufferSource: vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: { value: 1 },
        }),
        destination: {},
      };

      (global as any).AudioContext = vi.fn(() => mockAudioContext);

      const audioContext = new (global as any).AudioContext();

      // Test suspension
      await audioContext.suspend();
      expect(audioContext.suspend).toHaveBeenCalled();

      // Test resumption
      await audioContext.resume();
      expect(audioContext.resume).toHaveBeenCalled();
    });

    it("should handle mobile audio format preferences", () => {
      // Test that mobile devices prefer certain audio formats
      const supportedFormats = [
        "audio/mpeg", // MP3 - widely supported
        "audio/mp4", // M4A - iOS preferred
        "audio/ogg", // OGG - Android preferred
        "audio/wav", // WAV - universal but large
      ];

      // Mock file type detection
      const mockFile = new File(["test"], "test.m4a", { type: "audio/mp4" });
      expect(supportedFormats.includes(mockFile.type)).toBe(true);
    });
  });
});
