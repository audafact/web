import { supabase } from "./services/supabase";

/**
 * Debug JWT token generation and storage
 */
export async function debugJWT() {
  console.log("🔍 Debugging JWT Token...\n");

  try {
    // 1. Get current session
    console.log("1️⃣ Getting current session...");
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("❌ Session error:", sessionError);
      return;
    }

    if (!session) {
      console.log("⚠️  No active session found");
      return;
    }

    console.log("✅ Session found");
    console.log("   User ID:", session.user.id);
    console.log("   Access Token Length:", session.access_token?.length || 0);
    console.log("   Refresh Token Length:", session.refresh_token?.length || 0);

    // 2. Check access token structure
    if (session.access_token) {
      console.log("\n2️⃣ Analyzing access token...");
      const tokenParts = session.access_token.split(".");
      console.log("   Token parts:", tokenParts.length);

      if (tokenParts.length === 3) {
        try {
          // Decode header
          const header = JSON.parse(atob(tokenParts[0]));
          console.log("   Header:", header);

          // Decode payload
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log("   Payload keys:", Object.keys(payload));
          console.log(
            "   Expires:",
            new Date(payload.exp * 1000).toISOString()
          );

          // Check signature length
          console.log("   Signature length:", tokenParts[2].length);
        } catch (decodeError) {
          console.error("❌ Error decoding token parts:", decodeError);
        }
      } else {
        console.error("❌ Invalid token structure - expected 3 parts");
      }
    }

    // 3. Test token validation with Supabase
    if (session.access_token) {
      console.log("\n3️⃣ Testing token with Supabase...");
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

        console.log("   Response status:", response.status);
        const responseText = await response.text();
        console.log("   Response body:", responseText);

        if (response.ok) {
          console.log("✅ Token is valid with Supabase");
        } else {
          console.log("❌ Token validation failed");
        }
      } catch (fetchError) {
        console.error("❌ Error testing token:", fetchError);
      }
    }

    // 4. Check local storage
    console.log("\n4️⃣ Checking local storage...");
    const storageKeys = Object.keys(localStorage);
    const supabaseKeys = storageKeys.filter((key) => key.includes("supabase"));

    console.log("   Supabase storage keys:", supabaseKeys);

    supabaseKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        console.log(`   ${key}:`, value.substring(0, 100) + "...");
      }
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
}

/**
 * Test JWT token manually
 */
export function testJWTToken(token: string) {
  console.log("🧪 Testing JWT Token Manually...\n");

  try {
    const tokenParts = token.split(".");
    console.log("Token parts:", tokenParts.length);

    if (tokenParts.length === 3) {
      // Decode header
      const header = JSON.parse(atob(tokenParts[0]));
      console.log("Header:", header);

      // Decode payload
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("Payload keys:", Object.keys(payload));
      console.log("Expires:", new Date(payload.exp * 1000).toISOString());

      // Check signature
      console.log("Signature length:", tokenParts[2].length);

      // Test with Supabase
      testTokenWithSupabase(token);
    } else {
      console.error("Invalid token structure");
    }
  } catch (error) {
    console.error("Error testing token:", error);
  }
}

async function testTokenWithSupabase(token: string) {
  console.log("\n🔑 Testing with Supabase...");

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      }
    );

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);
  } catch (error) {
    console.error("Error testing with Supabase:", error);
  }
}
