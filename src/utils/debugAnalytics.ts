import { supabase } from "../services/supabase";

/**
 * Debug function to check analytics authentication
 * Call this from browser console: debugAnalyticsAuth()
 */
export const debugAnalyticsAuth = async () => {
  console.log("🔍 Debugging Analytics Authentication...\n");

  try {
    // 1. Check if user is signed in
    console.log("1️⃣ Checking user authentication...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.log("❌ Error getting user:", userError);
      return;
    }

    if (!user) {
      console.log("❌ No user found - you need to be signed in");
      console.log("   Please sign in to your application first");
      return;
    }

    console.log("✅ User found:", user.id);
    console.log("   Email:", user.email);

    // 2. Check session
    console.log("\n2️⃣ Checking session...");
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.log("❌ Error getting session:", sessionError);
      return;
    }

    if (!session) {
      console.log("❌ No session found");
      return;
    }

    console.log("✅ Session found");
    console.log("   Access token length:", session.access_token?.length || 0);
    console.log(
      "   Token preview:",
      session.access_token?.substring(0, 50) + "..."
    );

    // 3. Test token with Supabase
    console.log("\n3️⃣ Testing token with Supabase...");
    if (session.access_token) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );

        console.log("   Supabase response status:", response.status);
        if (response.ok) {
          console.log("✅ Token is valid with Supabase");
        } else {
          console.log("❌ Token validation failed with Supabase");
          const errorText = await response.text();
          console.log("   Error:", errorText);
        }
      } catch (fetchError) {
        console.error("❌ Error testing token with Supabase:", fetchError);
      }
    }

    // 4. Test token with your Worker
    console.log("\n4️⃣ Testing token with your Worker...");
    if (session.access_token) {
      try {
        const { API_CONFIG } = await import("../config/api");
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/analytics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            event: "test_event",
            sessionId: "test-session",
            timestamp: Date.now(),
            properties: { test: true },
            userTier: "free",
            version: "1.0.0",
            platform: "web",
          }),
        });

        console.log("   Worker response status:", response.status);
        if (response.ok) {
          console.log("✅ Token works with your Worker!");
          const responseData = await response.json();
          console.log("   Response:", responseData);
        } else {
          console.log("❌ Token failed with your Worker");
          const errorText = await response.text();
          console.log("   Error:", errorText);
        }
      } catch (fetchError) {
        console.error("❌ Error testing token with Worker:", fetchError);
      }
    }

    // 5. Check localStorage
    console.log("\n5️⃣ Checking localStorage...");
    const storageKeys = Object.keys(localStorage);
    const supabaseKeys = storageKeys.filter((key) => key.includes("supabase"));
    console.log("   Supabase storage keys:", supabaseKeys);

    // 6. Summary
    console.log("\n📊 Summary:");
    console.log("   User signed in:", !!user);
    console.log("   Session exists:", !!session);
    console.log("   Access token exists:", !!session?.access_token);
    console.log("   Token length:", session?.access_token?.length || 0);

    if (user && session?.access_token) {
      console.log("\n✅ Everything looks good! Analytics should work.");
      console.log("   Try running: testAnalytics()");
    } else {
      console.log("\n❌ Issues found. Please sign in to your application.");
    }
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
};

// Make function available globally for testing
if (typeof window !== "undefined") {
  (window as any).debugAnalyticsAuth = debugAnalyticsAuth;
}
