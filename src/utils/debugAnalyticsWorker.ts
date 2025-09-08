/**
 * Debug function to test analytics worker directly
 * Call this from browser console: debugAnalyticsWorker()
 */
export const debugAnalyticsWorker = async () => {
  console.log("🔍 Debugging Analytics Worker...\n");

  try {
    const { API_CONFIG } = await import("../config/api");

    // Test with a simple analytics event
    const testEvent = {
      event: "test_debug_event",
      sessionId: "debug-session-" + Date.now(),
      timestamp: Date.now(),
      properties: {
        test: true,
        debug: true,
        source: "debug_function",
      },
      userTier: "guest",
      version: "1.0.0",
      platform: "web",
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenSize: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      networkStatus: navigator.onLine ? "online" : "offline",
    };

    console.log("📤 Sending test event to worker:", testEvent);

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testEvent),
    });

    console.log("📥 Worker response status:", response.status);
    console.log(
      "📥 Worker response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("📥 Worker response body:", responseText);

    if (response.ok) {
      console.log("✅ Worker test successful!");
      try {
        const responseData = JSON.parse(responseText);
        console.log("📊 Parsed response:", responseData);
      } catch (parseError) {
        console.log("⚠️ Response is not JSON:", responseText);
      }
    } else {
      console.log("❌ Worker test failed");
      console.log("   Status:", response.status);
      console.log("   Response:", responseText);
    }

    return {
      success: response.ok,
      status: response.status,
      response: responseText,
    };
  } catch (error) {
    console.error("❌ Debug error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Make function available globally for testing
if (typeof window !== "undefined") {
  (window as any).debugAnalyticsWorker = debugAnalyticsWorker;
}
