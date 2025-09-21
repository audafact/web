import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TikTokCompleteRegistrationRequest {
  event_id: string;
  email?: string; // optional email for hashing
  ttclid?: string; // optional TikTok click ID
}

interface TikTokPayload {
  pixel_code: string;
  event: string;
  event_id: string;
  timestamp: number;
  context: {
    ip?: string;
    user_agent?: string;
    ad?: {
      callback?: string;
    };
  };
  user?: {
    email?: string;
  };
}

async function sha256Lower(s?: string): Promise<string | undefined> {
  if (!s) return undefined;
  const d = new TextEncoder().encode(s.trim().toLowerCase());
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get environment variables
    const PIXEL_ID = Deno.env.get("TIKTOK_PIXEL_ID");
    const ACCESS_TOKEN = Deno.env.get("TIKTOK_ACCESS_TOKEN");

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.error(
        "Missing required environment variables: TIKTOK_PIXEL_ID or TIKTOK_ACCESS_TOKEN"
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: TikTokCompleteRegistrationRequest = await req.json();

    // Validate required fields
    if (!body.event_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required field: event_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get client IP and User Agent from request headers
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "unknown";

    // Hash email if provided
    const hashedEmail = body.email ? await sha256Lower(body.email) : undefined;

    // Build TikTok payload
    const payload: TikTokPayload = {
      pixel_code: PIXEL_ID,
      event: "CompleteRegistration",
      event_id: body.event_id,
      timestamp: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
      context: {
        ip: clientIp,
        user_agent: userAgent,
        ...(body.ttclid && {
          ad: {
            callback: body.ttclid,
          },
        }),
      },
      ...(hashedEmail && {
        user: {
          email: hashedEmail,
        },
      }),
    };

    console.log("Sending TikTok CompleteRegistration event:", {
      event_id: body.event_id,
      pixel_id: PIXEL_ID,
      has_email: !!body.email,
      has_ttclid: !!body.ttclid,
      client_ip: clientIp,
    });

    // Send to TikTok Events API
    const tiktokResponse = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/pixel/track/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": ACCESS_TOKEN,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!tiktokResponse.ok) {
      const errorText = await tiktokResponse.text();
      console.error("TikTok Events API error:", {
        status: tiktokResponse.status,
        statusText: tiktokResponse.statusText,
        body: errorText,
      });

      return new Response(
        JSON.stringify({
          error: "Failed to send event to TikTok Events API",
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tiktokResult = await tiktokResponse.json();
    console.log("TikTok Events API success:", tiktokResult);

    return new Response(
      JSON.stringify({
        success: true,
        event_id: body.event_id,
        tiktok_response: tiktokResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("TikTok Events API function error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
