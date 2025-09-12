import { supabase } from "./services/supabase";

const WORKER_URL = "https://audafact-api.david-g-cortinas.workers.dev";

/**
 * Test R2 migration directly from the browser
 */
export async function testR2MigrationInBrowser() {
  console.log("🧪 Testing R2 Migration in Browser...\n");

  try {
    // 1️⃣ Get current session and JWT
    console.log("1️⃣ Getting current session...");
    const jwtToken = await getCurrentJWT();
    if (!jwtToken) {
      console.log("❌ No JWT token found in session");
      return false;
    }

    console.log("✅ Got JWT token from session");
    console.log("   Token length:", jwtToken.length);
    console.log("   User ID:", (await supabase.auth.getUser()).data.user?.id);

    // 2️⃣ Test Worker API with a real hash-based key
    console.log("\n2️⃣ Testing Worker API...");

    // Use a real hash-based key from your migrated tracks
    const testKey =
      "library/originals/break-the-chains-version-1-2c7a13d7fa.mp3"; // Real key from your migration

    console.log("   Testing with key:", testKey);
    const response = await fetch(
      `${WORKER_URL}/api/sign-file?key=${encodeURIComponent(testKey)}`,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      }
    );

    console.log("   Response status:", response.status);
    const responseText = await response.text();
    console.log("   Response body:", responseText);

    if (response.ok) {
      console.log("✅ Worker API test successful!");

      // 3️⃣ Test presigned URL generation
      console.log("\n3️⃣ Testing presigned URL generation...");
      try {
        const presignedData = JSON.parse(responseText);
        if (presignedData.url) {
          console.log("✅ Got presigned URL:", presignedData.url);
          console.log("   Expires:", presignedData.expiresAt);

          // Test if the presigned URL is accessible
          const urlResponse = await fetch(presignedData.url, {
            method: "HEAD",
          });
          console.log(
            "   URL accessibility:",
            urlResponse.ok ? "✅ Accessible" : "❌ Not accessible"
          );
        } else {
          console.log("❌ No presigned URL in response");
        }
      } catch (parseError) {
        console.log("❌ Could not parse presigned URL response");
      }

      return true;
    } else {
      console.log("❌ Worker API test failed");
      return false;
    }
  } catch (error) {
    console.error("❌ Error testing R2 migration:", error);
    return false;
  }
}

/**
 * Get the current JWT token for external use
 */
export async function getCurrentJWT(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error("Error getting JWT:", error);
    return null;
  }
}

/**
 * Test a specific JWT token with the Worker API
 */
export async function testJWTWithWorker(
  jwtToken: string,
  fileKey: string = "library/originals/ron-drums.wav"
) {
  console.log("🔑 Testing JWT with Worker API...\n");
  console.log("File key:", fileKey);

  try {
    const response = await fetch(
      `${WORKER_URL}/api/sign-file?key=${encodeURIComponent(fileKey)}`,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      }
    );

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      console.log("✅ JWT is working with Worker API!");
      return true;
    } else {
      console.log("❌ JWT failed with Worker API");
      return false;
    }
  } catch (error) {
    console.error("Error testing JWT:", error);
    return false;
  }
}

// Make functions available globally for browser console testing
if (typeof window !== "undefined") {
  (window as any).testR2MigrationInBrowser = testR2MigrationInBrowser;
  (window as any).getCurrentJWT = getCurrentJWT;
  (window as any).testJWTWithWorker = testJWTWithWorker;
}
