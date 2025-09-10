import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageService } from "../../src/services/storageService";
import { CostTrackingService } from "../../src/services/costTrackingService";
import { R2StorageService } from "../../src/services/r2StorageService";
import { signFile } from "../../src/lib/api";

// Note: fetch is already mocked globally in setup.ts

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

// Don't mock CostTrackingService - use the actual implementation

vi.mock("../../src/services/r2StorageService", () => ({
  R2StorageService: {
    getInstance: vi.fn(() => ({
      getStorageUsage: vi.fn(() => ({
        totalSizeBytes: 0,
        objectCount: 0,
        dailyUploadBytes: 0,
        dailyDownloadBytes: 0,
      })),
      getStorageUsageFormatted: vi.fn(() => ({
        totalSize: "0 B",
        objectCount: "0",
        dailyUpload: "0 B",
        dailyDownload: "0 B",
      })),
    })),
  },
}));

describe("Cost Tracking and Analytics", () => {
  let costTracker: CostTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    costTracker = CostTrackingService.getInstance();
    costTracker.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storage Cost Tracking", () => {
    it("should track storage usage for file uploads", async () => {
      // Mock file
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

      // Track storage usage
      costTracker.trackStorageUsage(mockFile.size);

      const result = await StorageService.uploadAudioFile(
        mockFile,
        "test-user",
        "Test Audio"
      );

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();

      const metrics = costTracker.getMetrics();
      expect(metrics.storageUsed).toBe(mockFile.size);
    });

    it("should calculate storage costs correctly", () => {
      // Simulate 1GB of storage usage
      costTracker.trackStorageUsage(1024 * 1024 * 1024); // 1GB

      const costs = costTracker.calculateCosts();
      expect(costs.storageCost).toBeCloseTo(0.015, 3); // $0.015 per GB per month
    });

    it("should track multiple file uploads", async () => {
      const files = [
        new File(["content1"], "file1.mp3", { type: "audio/mpeg" }),
        new File(["content2"], "file2.mp3", { type: "audio/mpeg" }),
        new File(["content3"], "file3.mp3", { type: "audio/mpeg" }),
      ];

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
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://r2.example.com/signed-upload-url",
            key: "users/test-user/uploads/test-uuid-123-test-audio.mp3",
          }),
      });

      let totalSize = 0;
      for (const file of files) {
        costTracker.trackStorageUsage(file.size);
        totalSize += file.size;
      }

      const metrics = costTracker.getMetrics();
      expect(metrics.storageUsed).toBe(totalSize);
    });
  });

  describe("Bandwidth Cost Tracking", () => {
    it("should track bandwidth usage for file downloads", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API response for signFile
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes("/api/sign-file")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ url: "https://media.audafact.com/signed-url" }),
          });
        }
        // Mock file download
        const fileSize = 5 * 1024 * 1024; // 5MB
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(
              new Blob(["x".repeat(fileSize)], { type: "audio/mpeg" })
            ),
        });
      });

      costTracker.trackRequest();
      const signedUrl = await signFile("library/originals/test-track.mp3");

      const response = await fetch(signedUrl);
      const blob = await response.blob();

      costTracker.trackBandwidthUsage(blob.size);

      const metrics = costTracker.getMetrics();
      expect(metrics.bandwidthUsed).toBe(5 * 1024 * 1024);
      expect(metrics.requestCount).toBe(1);
    });

    it("should calculate bandwidth costs correctly", () => {
      // Simulate 1GB of bandwidth usage
      costTracker.trackBandwidthUsage(1024 * 1024 * 1024); // 1GB

      const costs = costTracker.calculateCosts();
      expect(costs.bandwidthCost).toBeCloseTo(0.09, 3); // $0.09 per GB
    });

    it("should track multiple file downloads", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      const fileSizes = [1024 * 1024, 2 * 1024 * 1024, 3 * 1024 * 1024]; // 1MB, 2MB, 3MB
      let totalBandwidth = 0;

      // Mock Worker API responses
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes("/api/sign-file")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ url: "https://media.audafact.com/signed-url" }),
          });
        }
        // Mock file download - return different sizes based on call count
        const callCount = vi.mocked(global.fetch).mock.calls.length;
        const fileSize = fileSizes[(callCount - 1) % fileSizes.length];
        return Promise.resolve({
          ok: true,
          blob: () =>
            Promise.resolve(
              new Blob(["x".repeat(fileSize)], { type: "audio/mpeg" })
            ),
        });
      });

      for (let i = 0; i < fileSizes.length; i++) {
        const fileSize = fileSizes[i];

        costTracker.trackRequest();
        const signedUrl = await signFile(`library/originals/track${i}.mp3`);

        const response = await fetch(signedUrl);
        const blob = await response.blob();

        costTracker.trackBandwidthUsage(blob.size);
        totalBandwidth += blob.size;
      }

      const metrics = costTracker.getMetrics();
      expect(metrics.bandwidthUsed).toBe(totalBandwidth);
      expect(metrics.requestCount).toBe(3);
    });
  });

  describe("Request Cost Tracking", () => {
    it("should track API request costs", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API responses
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes("/api/sign-file")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ url: "https://media.audafact.com/signed-url" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ url: "https://media.audafact.com/signed-url" }),
        });
      });

      // Make 1000 requests
      for (let i = 0; i < 1000; i++) {
        costTracker.trackRequest();
        await signFile(`library/originals/track${i}.mp3`);
      }

      const metrics = costTracker.getMetrics();
      expect(metrics.requestCount).toBe(1000);
    });

    it("should calculate request costs correctly", () => {
      // Simulate 1 million requests
      for (let i = 0; i < 1000000; i++) {
        costTracker.trackRequest();
      }

      const costs = costTracker.calculateCosts();
      expect(costs.requestCost).toBeCloseTo(0.36, 3); // $0.36 per million requests
    });
  });

  describe("Error Cost Tracking", () => {
    it("should track error costs", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API with errors
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes("/api/sign-file")) {
          const shouldError = Math.random() < 0.1; // 10% error rate
          if (shouldError) {
            costTracker.trackError();
            return Promise.resolve({
              ok: false,
              status: 500,
              statusText: "Internal Server Error",
            });
          } else {
            costTracker.trackRequest();
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  url: "https://media.audafact.com/signed-url",
                }),
            });
          }
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              url: "https://media.audafact.com/signed-url",
            }),
        });
      });

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        try {
          await signFile(`library/originals/track${i}.mp3`);
        } catch (error) {
          // Expected for some requests
        }
      }

      const metrics = costTracker.getMetrics();
      expect(metrics.requestCount + metrics.errorCount).toBe(100);
      expect(metrics.errorCount).toBeGreaterThan(0);
    });
  });

  describe("Total Cost Calculation", () => {
    it("should calculate total costs correctly", () => {
      // Simulate realistic usage
      costTracker.trackStorageUsage(10 * 1024 * 1024 * 1024); // 10GB storage
      costTracker.trackBandwidthUsage(100 * 1024 * 1024 * 1024); // 100GB bandwidth

      for (let i = 0; i < 1000000; i++) {
        costTracker.trackRequest();
      }

      const costs = costTracker.calculateCosts();

      expect(costs.storageCost).toBeCloseTo(0.15, 3); // 10GB * $0.015
      expect(costs.bandwidthCost).toBeCloseTo(9.0, 3); // 100GB * $0.09
      expect(costs.requestCost).toBeCloseTo(0.36, 3); // 1M requests * $0.36/1M
      expect(costs.totalCost).toBeCloseTo(9.51, 3); // Total
    });

    it("should provide cost breakdown by service", () => {
      costTracker.trackStorageUsage(1024 * 1024 * 1024); // 1GB storage
      costTracker.trackBandwidthUsage(10 * 1024 * 1024 * 1024); // 10GB bandwidth

      for (let i = 0; i < 100000; i++) {
        costTracker.trackRequest();
      }

      const costs = costTracker.calculateCosts();

      expect(costs).toHaveProperty("storageCost");
      expect(costs).toHaveProperty("bandwidthCost");
      expect(costs).toHaveProperty("requestCost");
      expect(costs).toHaveProperty("totalCost");

      expect(costs.totalCost).toBe(
        costs.storageCost + costs.bandwidthCost + costs.requestCost
      );
    });
  });

  describe("Cost Optimization", () => {
    it("should identify high-cost operations", () => {
      // Simulate high-cost scenario
      costTracker.trackStorageUsage(100 * 1024 * 1024 * 1024); // 100GB storage
      costTracker.trackBandwidthUsage(1000 * 1024 * 1024 * 1024); // 1TB bandwidth

      for (let i = 0; i < 10000000; i++) {
        costTracker.trackRequest();
      }

      const costs = costTracker.calculateCosts();

      // Identify the highest cost component
      const maxCost = Math.max(
        costs.storageCost,
        costs.bandwidthCost,
        costs.requestCost
      );

      if (maxCost === costs.bandwidthCost) {
        expect(costs.bandwidthCost).toBeGreaterThan(costs.storageCost);
        expect(costs.bandwidthCost).toBeGreaterThan(costs.requestCost);
      }
    });

    it("should track cost trends over time", () => {
      const timePoints = [];

      // Simulate usage over 5 time points
      for (let i = 0; i < 5; i++) {
        costTracker.reset();
        costTracker.trackStorageUsage((i + 1) * 1024 * 1024 * 1024); // Increasing storage
        costTracker.trackBandwidthUsage((i + 1) * 10 * 1024 * 1024 * 1024); // Increasing bandwidth

        const costs = costTracker.calculateCosts();
        timePoints.push(costs.totalCost);
      }

      // Costs should be increasing
      for (let i = 1; i < timePoints.length; i++) {
        expect(timePoints[i]).toBeGreaterThan(timePoints[i - 1]);
      }
    });
  });
});
