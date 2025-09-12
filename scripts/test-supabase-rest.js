import dotenv from "dotenv";

dotenv.config();

async function testSupabaseRest() {
  try {
    console.log("🧪 Testing Supabase REST API directly...\n");

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const trackId = "break-the-chains-version-1";

    console.log(
      "Querying:",
      `${supabaseUrl}/rest/v1/library_tracks?track_id=eq.${trackId}&select=is_pro_only`
    );
    console.log("Using anon key:", anonKey ? "✅ Set" : "❌ Missing");

    const response = await fetch(
      `${supabaseUrl}/rest/v1/library_tracks?track_id=eq.${trackId}&select=is_pro_only`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }
    );

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log("Parsed data:", data);
      } catch (parseError) {
        console.log("Could not parse response as JSON");
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testSupabaseRest();
