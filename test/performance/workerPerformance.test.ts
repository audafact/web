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

describe("Worker Performance Monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Response Time Monitoring", () => {
    it("should measure Worker API response times", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API response with controlled timing
      (global.fetch as any).mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({
                      url: "https://media.audafact.com/signed-url",
                    }),
                  }),
                100
              ) // 100ms delay
          )
      );

      const startTime = performance.now();
      await signFile("library/originals/test-track.mp3");
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeGreaterThan(90); // Should be at least 90ms
      expect(responseTime).toBeLessThan(200); // Should be less than 200ms
    });

    it("should track multiple request response times", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      const responseTimes: number[] = [];

      // Mock Worker API with varying response times
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            const delay = Math.random() * 100 + 50; // 50-150ms
            setTimeout(() => {
              responseTimes.push(delay);
              resolve({
                ok: true,
                json: async () => ({
                  url: "https://media.audafact.com/signed-url",
                }),
              });
            }, delay);
          })
      );

      // Make multiple requests
      const requests = Array(5)
        .fill(null)
        .map(() => signFile("library/originals/test-track.mp3"));

      await Promise.all(requests);

      expect(responseTimes).toHaveLength(5);
      expect(responseTimes.every((time) => time >= 50 && time <= 150)).toBe(
        true
      );
    });

    it("should detect slow responses", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock slow Worker API response
      (global.fetch as any).mockImplementation(
        () =>
          new Promise(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({
                      url: "https://media.audafact.com/signed-url",
                    }),
                  }),
                1000
              ) // 1 second delay
          )
      );

      const startTime = performance.now();
      await signFile("library/originals/test-track.mp3");
      const endTime = performance.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeGreaterThan(900); // Should be at least 900ms
      expect(responseTime).toBeLessThan(1100); // Should be less than 1100ms
    });
  });

  describe("Throughput Monitoring", () => {
    it("should measure requests per second", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock fast Worker API response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://media.audafact.com/signed-url" }),
      });

      const startTime = performance.now();

      // Make 10 requests
      const requests = Array(10)
        .fill(null)
        .map(() => signFile("library/originals/test-track.mp3"));

      await Promise.all(requests);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const requestsPerSecond = (10 / totalTime) * 1000;

      expect(requestsPerSecond).toBeGreaterThan(5); // Should handle at least 5 RPS
    });

    it("should handle concurrent requests efficiently", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://media.audafact.com/signed-url" }),
      });

      const startTime = performance.now();

      // Make 20 concurrent requests
      const requests = Array(20)
        .fill(null)
        .map(() => signFile("library/originals/test-track.mp3"));

      const results = await Promise.all(requests);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(20);
      expect(
        results.every((url) => url === "https://media.audafact.com/signed-url")
      ).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Error Rate Monitoring", () => {
    it("should track error rates", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      let errorCount = 0;
      let successCount = 0;

      // Mock Worker API with 20% error rate
      (global.fetch as any).mockImplementation(() => {
        const shouldError = Math.random() < 0.2;
        if (shouldError) {
          errorCount++;
          return Promise.reject(new Error("Worker API error"));
        } else {
          successCount++;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              url: "https://media.audafact.com/signed-url",
            }),
          });
        }
      });

      // Make 50 requests
      const requests = Array(50)
        .fill(null)
        .map(async () => {
          try {
            await signFile("library/originals/test-track.mp3");
          } catch (error) {
            // Expected for some requests
          }
        });

      await Promise.all(requests);

      const totalRequests = errorCount + successCount;
      const errorRate = errorCount / totalRequests;

      expect(totalRequests).toBe(50);
      expect(errorRate).toBeGreaterThanOrEqual(0.05); // Should have some errors
      expect(errorRate).toBeLessThan(0.3); // But not too many
    });

    it("should handle different error types", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      const errorTypes = [
        { status: 401, message: "Unauthorized" },
        { status: 403, message: "Forbidden" },
        { status: 429, message: "Rate Limited" },
        { status: 500, message: "Internal Server Error" },
      ];

      let errorIndex = 0;

      // Mock Worker API with different error types
      (global.fetch as any).mockImplementation(() => {
        const error = errorTypes[errorIndex % errorTypes.length];
        errorIndex++;
        return Promise.resolve({
          ok: false,
          status: error.status,
          statusText: error.message,
        });
      });

      // Test each error type
      for (const errorType of errorTypes) {
        await expect(
          signFile("library/originals/test-track.mp3")
        ).rejects.toThrow(`sign-file failed: ${errorType.status}`);
      }
    });
  });

  describe("Resource Usage Monitoring", () => {
    it("should monitor memory usage during operations", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      // Mock Worker API response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://media.audafact.com/signed-url" }),
      });

      // Get initial memory usage (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Make multiple requests
      const requests = Array(100)
        .fill(null)
        .map(() => signFile("library/originals/test-track.mp3"));

      await Promise.all(requests);

      // Get final memory usage (if available)
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory usage should not increase dramatically
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }
    });

    it("should handle large file uploads efficiently", async () => {
      // Mock large file
      const largeFile = new File(
        ["x".repeat(10 * 1024 * 1024)],
        "large-audio.mp3",
        {
          type: "audio/mpeg",
        }
      ); // 10MB file

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
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: "https://r2.example.com/signed-upload-url",
            key: "users/test-user/uploads/test-uuid-123-large-audio.mp3",
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      const startTime = performance.now();
      const result = await StorageService.uploadAudioFile(
        largeFile,
        "test-user",
        "Large Audio"
      );
      const endTime = performance.now();

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();

      const uploadTime = endTime - startTime;
      expect(uploadTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Performance Metrics Collection", () => {
    it("should collect comprehensive performance metrics", async () => {
      // Mock Supabase session
      const { supabase } = await import("../../src/services/supabase");
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      });

      const metrics = {
        requestCount: 0,
        totalResponseTime: 0,
        errorCount: 0,
        successCount: 0,
      };

      // Mock Worker API with metrics collection
      (global.fetch as any).mockImplementation(() => {
        metrics.requestCount++;
        const startTime = performance.now();

        return new Promise((resolve) => {
          // Use deterministic pattern: every 10th request fails (10% error rate)
          const shouldError = metrics.requestCount % 10 === 0;
          const responseTime = 50 + (metrics.requestCount % 100); // 50-149ms response time

          setTimeout(() => {
            const endTime = performance.now();
            metrics.totalResponseTime += endTime - startTime;

            if (shouldError) {
              metrics.errorCount++;
              resolve({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
              });
            } else {
              metrics.successCount++;
              resolve({
                ok: true,
                json: async () => ({
                  url: "https://media.audafact.com/signed-url",
                }),
              });
            }
          }, responseTime);
        });
      });

      // Make 20 requests
      const requests = Array(20)
        .fill(null)
        .map(async () => {
          try {
            await signFile("library/originals/test-track.mp3");
          } catch (error) {
            // Expected for some requests
          }
        });

      await Promise.all(requests);

      // Calculate metrics
      const averageResponseTime =
        metrics.totalResponseTime / metrics.requestCount;
      const errorRate = metrics.errorCount / metrics.requestCount;
      const successRate = metrics.successCount / metrics.requestCount;

      expect(metrics.requestCount).toBe(20);
      expect(averageResponseTime).toBeGreaterThan(50);
      expect(averageResponseTime).toBeLessThan(150);
      expect(errorRate).toBeGreaterThan(0);
      expect(errorRate).toBeLessThanOrEqual(0.3); // Allow up to 30% error rate for performance testing
      expect(successRate).toBeGreaterThan(0.8);
      expect(successRate).toBeLessThan(1);
    });
  });
});
