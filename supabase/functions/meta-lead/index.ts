/// <reference types="https://deno.land/x/types/deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MetaLeadRequest {
  event_id: string;
  em: string; // SHA-256 hashed email
  fbp?: string; // Facebook browser ID
  fbc?: string; // Facebook click ID
  sourceUrl: string;
}

interface MetaCapiPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    action_source: string;
    event_source_url: string;
    event_id: string;
    user_data: {
      em: string[];
      fbp?: string;
      fbc?: string;
      client_ip_address?: string;
      client_user_agent?: string;
    };
  }>;
  test_event_code?: string;
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
    const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.error(
        "Missing required environment variables: META_PIXEL_ID or META_ACCESS_TOKEN"
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
    const body: MetaLeadRequest = await req.json();

    // Validate required fields
    if (!body.event_id || !body.em || !body.sourceUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: event_id, em, or sourceUrl",
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

    // Build Meta CAPI payload
    const capiPayload: MetaCapiPayload = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          action_source: "website",
          event_source_url: body.sourceUrl,
          event_id: body.event_id,
          user_data: {
            em: [body.em], // Array of hashed emails
            client_ip_address: clientIp,
            client_user_agent: userAgent,
            ...(body.fbp && { fbp: body.fbp }),
            ...(body.fbc && { fbc: body.fbc }),
          },
        },
      ],
    };

    // Test event code removed for production

    console.log("Sending Meta CAPI event:", {
      event_id: body.event_id,
      pixel_id: PIXEL_ID,
      has_fbp: !!body.fbp,
      has_fbc: !!body.fbc,
      client_ip: clientIp,
    });

    // Send to Meta Conversions API (using dataset endpoint for new UI)
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(capiPayload),
      }
    );

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error("Meta CAPI error:", {
        status: metaResponse.status,
        statusText: metaResponse.statusText,
        body: errorText,
      });

      return new Response(
        JSON.stringify({
          error: "Failed to send event to Meta CAPI",
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const metaResult = await metaResponse.json();
    console.log("Meta CAPI success:", metaResult);

    return new Response(
      JSON.stringify({
        success: true,
        event_id: body.event_id,
        meta_response: metaResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Meta CAPI function error:", error);

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
