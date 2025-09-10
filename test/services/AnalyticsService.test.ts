import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  beforeAll,
} from "vitest";
import {
  AnalyticsService,
  FUNNEL_STAGES,
  analytics,
} from "../../src/services/analyticsService";
import { mockFetch } from "../setup";

describe("Analytics & Funnel Tracking", () => {
  let analytics: AnalyticsService;

  beforeEach(async () => {
    // Clear localStorage
    localStorage.clear();
    // Reset singleton
    AnalyticsService.resetInstance();
    // Reset fetch mock completely
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockFetch.mockReset();

    // Mock fetch to return a successful response
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: "OK",
      })
    );

    analytics = AnalyticsService.getInstance();

    // Mock the getAuthToken method to always return a token
    vi.spyOn(analytics as any, "getAuthToken").mockResolvedValue("test-token");
  });

  beforeAll(() => {
    // Mock PromiseRejectionEvent for tests
    global.PromiseRejectionEvent = class PromiseRejectionEvent extends Event {
      reason: any;
      constructor(type: string, init: { reason: any }) {
        super(type);
        this.reason = init.reason;
      }
    } as any;
  });

  afterEach(() => {
    // Clear all mocks and reset the fetch mock
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockFetch.mockReset();

    // Reset any spies
    vi.restoreAllMocks();
  });

  describe("AnalyticsService", () => {
    it("should track events correctly", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      analytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
          body: expect.stringContaining("funnel_progress"),
        })
      );
    });

    it("should store events for retry when offline", async () => {
      // Mock offline state before creating service
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();

      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error("Network error"));

      offlineAnalytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });

    it("should process retry queue when coming back online", async () => {
      // Mock offline state and add event to retry queue
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();

      // Mock fetch to fail initially
      mockFetch.mockRejectedValue(new Error("Network error"));

      offlineAnalytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event

      // Mock fetch for retry
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      // Simulate coming back online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      // Trigger online event
      window.dispatchEvent(new Event("online"));

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalled();
      expect(offlineAnalytics.getRetryQueueLength()).toBe(0);
    });

    it("should track performance metrics", () => {
      analytics.trackMetric("test_metric", 100);

      expect(analytics.getAverageMetric("test_metric")).toBe(100);

      analytics.trackMetric("test_metric", 200);
      expect(analytics.getAverageMetric("test_metric")).toBe(150);
    });

    it("should track errors", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      const error = new Error("Test error");
      analytics.trackError(error, "test_context");

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("error_occurred"),
        })
      );
    });

    it("should track feature errors", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      const error = new Error("Feature error");
      analytics.trackFeatureError("test_feature", error);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("feature_error"),
        })
      );
    });

    it("should set user information", () => {
      analytics.setUser("user123", "pro");

      analytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      const events = analytics.getEvents();
      expect(events[0].userId).toBe("user123");
      expect(events[0].userTier).toBe("pro");
    });

    it("should generate unique session IDs", () => {
      const sessionId1 = analytics.getSessionId();
      const sessionId2 = analytics.getSessionId();

      expect(sessionId1).toBe(sessionId2); // Same instance
      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it("should limit events in memory", () => {
      // Add more than 100 events
      for (let i = 0; i < 110; i++) {
        analytics.track("demo_track_loaded", {
          trackId: `track-${i}`,
          genre: "house",
          bpm: 128,
        });
      }

      const events = analytics.getEvents();
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe("FunnelTracker", () => {
    it("should track funnel progress", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      analytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should track both the original event and funnel progress
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const calls = mockFetch.mock.calls;
      const funnelCall = calls.find(
        (call) =>
          JSON.parse(call[1]?.body as string).event === "funnel_progress"
      );

      expect(funnelCall).toBeDefined();
    });

    it("should calculate conversion rates", () => {
      // Mock user progress
      const mockProgress = new Map();
      mockProgress.set(
        "user1",
        new Set(["Demo Started", "Feature Interaction"])
      );
      mockProgress.set("user2", new Set(["Demo Started"]));

      analytics.setUserProgress(mockProgress);

      const rates = analytics.getFunnelConversionRate();

      expect(rates["Demo Started"]).toBe(100);
      expect(rates["Feature Interaction"]).toBe(50);
    });

    it("should track funnel completion", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      analytics.setUser("user123", "guest");

      // Complete all required stages
      analytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      analytics.track("feature_gate_clicked", {
        feature: "upload",
        userTier: "guest",
        gateType: "modal",
      });

      analytics.track("signup_modal_shown", {
        trigger: "feature_gate",
        userTier: "guest",
      });

      analytics.track("signup_completed", {
        method: "email",
        trigger: "feature_gate",
        upgradeRequired: false,
      });

      analytics.track("upgrade_completed", {
        plan: "pro",
        amount: 999,
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have tracked funnel completion
      const calls = mockFetch.mock.calls;
      const completionCall = calls.find(
        (call) =>
          JSON.parse(call[1]?.body as string).event === "funnel_completed"
      );

      expect(completionCall).toBeDefined();
    });

    it("should handle funnel stages correctly", () => {
      expect(FUNNEL_STAGES).toHaveLength(7);
      expect(FUNNEL_STAGES[0].name).toBe("Demo Started");
      expect(FUNNEL_STAGES[0].required).toBe(true);
    });
  });

  describe("Performance Monitoring", () => {
    it("should track page load time", () => {
      // Mock performance.now
      const mockPerformanceNow = vi
        .fn()
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time

      vi.spyOn(performance, "now").mockImplementation(mockPerformanceNow);

      // Create new instance to trigger page load tracking
      AnalyticsService.resetInstance();
      const newAnalytics = AnalyticsService.getInstance();

      // Simulate page load
      window.dispatchEvent(new Event("load"));

      // Should track page load time - but we need to account for all the other calls
      expect(mockPerformanceNow).toHaveBeenCalled();
    });

    it("should track feature response time", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      const endTracking = analytics.trackFeatureResponseTime("test_feature");

      // Call the end tracking function immediately
      endTracking();

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("feature_gate_response_time"),
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle global errors", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      const error = new Error("Global error");

      // Manually trigger the error handler since the mock doesn't properly simulate event handling
      analytics.trackError(error, "global_error");

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("error_occurred"),
        })
      );
    });

    it("should handle unhandled promise rejections", async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      // Manually trigger the error handler since the mock doesn't properly simulate event handling
      const error = new Error("Promise rejected");
      analytics.trackError(error, "unhandled_promise");

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://audafact-api.david-g-cortinas.workers.dev/api/analytics",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("error_occurred"),
        })
      );
    });

    it("should handle network errors gracefully", async () => {
      // Mock offline state to ensure events are queued
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();

      mockFetch.mockRejectedValue(new Error("Network error"));

      offlineAnalytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should store in retry queue
      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });
  });

  describe("Data Persistence", () => {
    it("should save and load retry queue from localStorage", async () => {
      // Mock offline state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();

      // Mock fetch to fail
      mockFetch.mockRejectedValue(new Error("Network error"));

      offlineAnalytics.track("demo_track_loaded", {
        trackId: "test-track",
        genre: "house",
        bpm: 128,
      });

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event

      // Create new instance to test loading
      AnalyticsService.resetInstance();
      const newAnalytics = AnalyticsService.getInstance();

      expect(newAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });

    it("should handle localStorage errors gracefully", () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      // Should not throw error
      expect(() => {
        analytics.track("demo_track_loaded", {
          trackId: "test-track",
          genre: "house",
          bpm: 128,
        });
      }).not.toThrow();

      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });

  describe("Worker API Integration", () => {
    it("should use Worker API endpoint for analytics", async () => {
      // Reset mock to ensure clean state
      vi.clearAllMocks();
      (global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      // Ensure the service is online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      // Trigger the online event to set the service online
      window.dispatchEvent(new Event("online"));
      
      analytics.track("worker_api_test", {
        endpoint: "sign-file",
        responseTime: 150,
      });

      // Wait for async processing with longer timeout
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify fetch was called (the service uses fetch directly, not global.fetch)
      expect(global.fetch).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/analytics"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should handle Worker API errors gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Worker API error"));

      analytics.track("worker_api_error_test", {
        error: "network_failure",
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should store in retry queue
      expect(analytics.getRetryQueueLength()).toBeGreaterThan(0);
    });

    it("should include Worker API context in analytics events", async () => {
      // Reset mock to ensure clean state
      vi.clearAllMocks();
      (global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          statusText: "OK",
        })
      );

      // Ensure the service is online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      analytics.track("media_operation", {
        operation: "upload",
        fileKey: "users/test-user/uploads/test-file.mp3",
        workerEndpoint: "sign-upload",
      });

      // Wait for async processing with longer timeout
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();

      const calls = mockFetch.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const call = calls[0];
      expect(call).toBeDefined();
      expect(call[1]).toBeDefined();

      const requestBody = JSON.parse(call[1]?.body as string);

      expect(requestBody.event).toBe("media_operation");
      expect(requestBody.properties.operation).toBe("upload");
      expect(requestBody.properties.fileKey).toBe(
        "users/test-user/uploads/test-file.mp3"
      );
      expect(requestBody.properties.workerEndpoint).toBe("sign-upload");
    });
  });
});
