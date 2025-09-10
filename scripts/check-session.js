import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSession() {
  try {
    console.log("🔍 Checking Supabase session...");

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("❌ Error getting session:", error);
      return;
    }

    if (!session) {
      console.log("❌ No active session found");
      console.log("\n💡 To run Phase 3 verification:");
      console.log("1. Open your web app in a browser");
      console.log("2. Log in to Supabase");
      console.log("3. Run the verification script");
      return;
    }

    console.log("✅ Active session found!");
    console.log("   User ID:", session.user.id);
    console.log("   Email:", session.user.email);
    console.log(
      "   Token expires:",
      new Date(session.expires_at * 1000).toLocaleString()
    );

    // Test the token with the Worker
    console.log("\n🧪 Testing token with Worker...");

    const response = await fetch(
      "https://audafact-api.david-g-cortinas.workers.dev/api/sign-file?key=library/originals/break-the-chains-version-1-2c7a13d7fa.mp3",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    console.log("   Worker response status:", response.status);

    if (response.ok) {
      console.log("✅ JWT token is working with Worker!");
      console.log("\n🚀 Ready to run Phase 3 verification!");
    } else {
      console.log("❌ JWT token not working with Worker");
      const responseText = await response.text();
      console.log("   Response:", responseText);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkSession();
