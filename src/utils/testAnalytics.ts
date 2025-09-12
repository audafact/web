import { analytics, trackEvent } from "../services/analyticsService";

/**
 * Test function to verify analytics service is working
 * Call this from browser console: testAnalytics()
 */
export const testAnalytics = async () => {
  console.log("🧪 Testing Analytics Service...");

  try {
    // Test 1: Check service health
    const health = analytics.getHealthStatus();
    console.log("📊 Analytics Health Status:", health);

    // Test 2: Track a test event
    console.log("📝 Tracking test event...");
    trackEvent("demo_track_loaded", {
      trackId: "test-track-123",
      genre: "test",
      bpm: 120,
    });

    // Test 3: Track a feature gate event
    console.log("🚪 Tracking feature gate event...");
    trackEvent("feature_gate_clicked", {
      feature: "test-feature",
      userTier: "guest",
      gateType: "test-gate",
    });

    // Test 4: Check events in memory
    const events = analytics.getEvents();
    console.log("📋 Events in memory:", events.length);

    // Test 5: Check retry queue
    const retryQueueLength = analytics.getRetryQueueLength();
    console.log("🔄 Retry queue length:", retryQueueLength);

    // Test 6: Check analytics errors
    const errors = analytics.getAnalyticsErrors();
    console.log("❌ Analytics errors:", errors.length);

    // Test 7: Test funnel conversion rates
    const conversionRates = analytics.getFunnelConversionRate();
    console.log("📈 Funnel conversion rates:", conversionRates);

    console.log("✅ Analytics test completed successfully!");

    return {
      success: true,
      health,
      eventsCount: events.length,
      retryQueueLength,
      errorsCount: errors.length,
      conversionRates,
    };
  } catch (error) {
    console.error("❌ Analytics test failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Test analytics with authentication
 * Call this from browser console: testAnalyticsWithAuth()
 */
export const testAnalyticsWithAuth = async () => {
  console.log("🔐 Testing Analytics with Authentication...");

  try {
    // Set a test user
    analytics.setUser("test-user-123", "free");

    // Track authenticated events
    trackEvent("signup_completed", {
      method: "email",
      trigger: "test",
      upgradeRequired: false,
    });

    trackEvent("library_track_added", {
      trackId: "test-library-track",
      genre: "test",
      userTier: "free",
    });

    // Check health with user set
    const health = analytics.getHealthStatus();
    console.log("📊 Analytics Health with User:", health);

    console.log("✅ Authenticated analytics test completed!");

    return {
      success: true,
      health,
    };
  } catch (error) {
    console.error("❌ Authenticated analytics test failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Make functions available globally for testing
if (typeof window !== "undefined") {
  (window as any).testAnalytics = testAnalytics;
  (window as any).testAnalyticsWithAuth = testAnalyticsWithAuth;
}
