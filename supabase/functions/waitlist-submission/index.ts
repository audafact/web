import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WaitlistSubmissionRequest {
  firstName: string;
  email: string;
  role?: string;
  daw?: string;
  genres?: string[];
  experience?: string;
  referralSource?: string;
  agreeUpdates: boolean;
  agreeStorage: boolean;
  earlyAccess: boolean;
  turnstileToken: string;
  referrerUrl?: string;
  signupPage?: string;
  utmParams?: Record<string, string>;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
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
    const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

    if (!TURNSTILE_SECRET_KEY) {
      console.error("Missing TURNSTILE_SECRET_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: WaitlistSubmissionRequest = await req.json();

    // Validate required fields
    if (!body.firstName || !body.email || !body.turnstileToken) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: firstName, email, or turnstileToken",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get client IP for Turnstile verification
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Step 1: Validate Turnstile token with Cloudflare
    const turnstileFormData = new FormData();
    turnstileFormData.append("secret", TURNSTILE_SECRET_KEY);
    turnstileFormData.append("response", body.turnstileToken);
    turnstileFormData.append("remoteip", clientIp);

    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: turnstileFormData,
      }
    );

    const turnstileResult: TurnstileResponse = await turnstileResponse.json();

    if (!turnstileResult.success) {
      console.error(
        "Turnstile validation failed:",
        turnstileResult["error-codes"]
      );
      return new Response(
        JSON.stringify({
          error: "Security verification failed. Please try again.",
          details: turnstileResult["error-codes"],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: If Turnstile validation passes, submit to HubSpot
    const hubspotPayload = {
      submittedAt: new Date().toISOString(),
      fields: [
        { name: "firstname", value: body.firstName },
        { name: "email", value: body.email },
        { name: "consent_to_comms", value: body.agreeUpdates.toString() },
        { name: "consent_to_process", value: body.agreeStorage.toString() },
        // Audafact Attribution properties
        { name: "referrer_url", value: body.referrerUrl || "" },
        { name: "signup_page", value: body.signupPage || "" },
        // UTM parameters
        ...(body.utmParams
          ? Object.entries(body.utmParams).map(([key, value]) => ({
              name: key,
              value: value,
            }))
          : []),
        // Package all user profile data into one JSON field
        {
          name: "user_profile",
          value: JSON.stringify({
            role: body.role,
            daw: body.daw,
            genres: body.genres || [],
            experience: body.experience,
            referralSource: body.referralSource,
            earlyAccess: body.earlyAccess,
          }),
        },
        // Turnstile verification timestamp
        { name: "turnstile_verified_at", value: new Date().toISOString() },
      ],
      context: {
        pageUri: body.signupPage || "",
        pageName: "Audafact Waitlist (Verified)",
      },
    };

    // Submit to HubSpot API
    const hubspotResponse = await fetch(
      "https://api.hsforms.com/submissions/v3/integration/submit/243862805/bd0ad51a-65d5-4a66-a983-f1919c76069b",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hubspotPayload),
      }
    );

    if (!hubspotResponse.ok) {
      const hubspotError = await hubspotResponse.text();
      console.error("HubSpot submission failed:", hubspotError);
      return new Response(
        JSON.stringify({
          error: "Failed to submit to waitlist. Please try again.",
          details: hubspotError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully added to waitlist!",
        turnstileVerified: true,
        hubspotSubmitted: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Waitlist submission error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred. Please try again.",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
