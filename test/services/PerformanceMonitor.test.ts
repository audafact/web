import { describe, it, expect, beforeEach, vi } from "vitest";
import { PerformanceMonitor } from "../../src/services/performanceMonitor";

// Note: fetch is already mocked globally in setup.ts

// Supabase is mocked globally in setup.ts

// Mock API config
vi.mock("../../src/config/api", () => ({
  API_CONFIG: {
    BASE_URL: "https://audafact-api.david-g-cortinas.workers.dev",
    ENDPOINTS: {
      ANALYTICS: "/api/analytics",
    },
  },
}));

describe("Performance Monitoring", () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset the singleton instance
    (PerformanceMonitor as any).instance = undefined;

    // Mock Supabase session
    const { supabase } = await import("../../src/services/supabase");
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
  });

  it("should track performance metrics", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetric("test_metric", 100);

    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].metric).toBe("test_metric");
    expect(metrics[0].value).toBe(100);
  });

  it("should measure timing accurately", async () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    const stopTimer = performanceMonitor.startTimer("test_timer");

    // Simulate some work
    setTimeout(() => {
      stopTimer();
    }, 100);

    // Wait for timer to complete
    await new Promise((resolve) => setTimeout(resolve, 200));
    const metrics = performanceMonitor.getMetrics();
    const timerMetric = metrics.find((m) => m.metric === "test_timer");
    expect(timerMetric).toBeDefined();
    expect(timerMetric!.value).toBeGreaterThan(90);
  });

  it("should track multiple metrics", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetrics("navigation", {
      loadTime: 100,
      domReady: 200,
      firstPaint: 150,
    });

    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toHaveLength(3);
    expect(metrics.some((m) => m.metric === "navigation_loadTime")).toBe(true);
    expect(metrics.some((m) => m.metric === "navigation_domReady")).toBe(true);
    expect(metrics.some((m) => m.metric === "navigation_firstPaint")).toBe(
      true
    );
  });

  it("should store metrics in localStorage", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetric("test_metric", 100);

    const stored = localStorage.getItem("performance_metrics");
    expect(stored).toBeDefined();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].metric).toBe("test_metric");
  });

  it("should limit stored metrics to 100", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    // Add 110 metrics
    for (let i = 0; i < 110; i++) {
      performanceMonitor.trackMetric(`metric_${i}`, i);
    }

    const metrics = performanceMonitor.getMetrics();
    expect(metrics).toHaveLength(100);
    expect(metrics[0].metric).toBe("metric_10"); // First 10 should be removed
  });

  it("should include context in metrics", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetric("test_metric", 100, {
      feature: "test",
      userTier: "guest",
    });

    const metrics = performanceMonitor.getMetrics();
    expect(metrics[0].context).toEqual({
      feature: "test",
      userTier: "guest",
    });
  });

  it("should generate unique session IDs", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetric("test_metric", 100);

    const metrics = performanceMonitor.getMetrics();
    expect(metrics[0].sessionId).toMatch(/^session_\d+$/);
  });

  it("should clear metrics", () => {
    const performanceMonitor = PerformanceMonitor.getInstance();

    performanceMonitor.trackMetric("test_metric", 100);
    expect(performanceMonitor.getMetrics()).toHaveLength(1);

    performanceMonitor.clearMetrics();
    expect(performanceMonitor.getMetrics()).toHaveLength(0);
  });
});
