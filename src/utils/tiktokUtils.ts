/**
 * TikTok tracking utilities for client-side tracking
 */

/**
 * Sets ttclid cookie from URL parameters on landing page
 * Run this once on landing (e.g., in your app bootstrap)
 */
export function setTtclidCookieFromURL(): void {
  const url = new URL(window.location.href);
  const ttclid = url.searchParams.get("ttclid");

  if (!ttclid) return;

  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const isSecure = location.protocol === "https:";

  document.cookie = `ttclid=${ttclid}; Max-Age=${maxAge}; Path=/; SameSite=Lax${
    isSecure ? "; Secure" : ""
  }`;
}

/**
 * Gets ttclid from cookie
 */
export function getTtclidFromCookie(): string | null {
  const cookie = document.cookie || "";
  const match = cookie.match(/(?:^|;\s*)ttclid=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Pushes complete_registration event to dataLayer for TikTok GTM tracking
 * @param userEmail - User's email address
 * @param eventId - Unique event ID (must match server-side event ID)
 */
export function onSignupSuccess(userEmail: string, eventId: string): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "complete_registration",
    event_id: eventId,
    user_email: userEmail,
  });
}

/**
 * Sends CompleteRegistration event to TikTok via Supabase Edge Function
 * @param eventId - Unique event ID (must match client-side event ID)
 * @param email - User's email address (optional)
 * @param ttclid - TikTok click ID (optional, will be read from cookie if not provided)
 */
export async function sendTikTokCompleteRegistration(
  eventId: string,
  email?: string,
  ttclid?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Supabase URL from environment
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error("VITE_SUPABASE_URL is not configured");
      return { success: false, error: "Supabase URL not configured" };
    }

    // Use provided ttclid or read from cookie
    const finalTtclid = ttclid || getTtclidFromCookie();

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseAnonKey) {
      console.error("VITE_SUPABASE_ANON_KEY is not configured");
      return { success: false, error: "Supabase anon key not configured" };
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/tiktok-complete-registration`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          event_id: eventId,
          email,
          ttclid: finalTtclid,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TikTok tracking failed:", errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log("TikTok tracking success:", result);
    return { success: true };
  } catch (error) {
    console.error("TikTok tracking error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generates a unique event ID for tracking
 */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
