import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type FeedbackKind = "contact" | "feedback";

interface FeedbackSubmissionBody {
  kind: FeedbackKind;
  turnstileToken?: string;
  /** contact */
  name?: string;
  email?: string;
  subject?: string;
  inquiryType?: string;
  /** feedback */
  title?: string;
  message?: string;
  type?: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

function mapInquiryToNotionType(inquiry: string | undefined): string {
  switch (inquiry) {
    case "bug":
      return "Bug";
    case "feature":
      return "Feature";
    case "beta":
      return "UX";
    case "general":
      return "Question";
    case "business":
    case "music-contribution":
    default:
      return "Other";
  }
}

function normalizeFeedbackType(raw: string | undefined): string {
  const allowed = new Set(["Bug", "Feature", "UX", "Question", "Other"]);
  const t = (raw || "Other").trim();
  return allowed.has(t) ? t : "Other";
}

function mapDbTier(raw: string | null | undefined): "Free" | "Pro" | "Starter" | "Unknown" {
  const t = (raw || "free").toLowerCase();
  if (t === "pro" || t === "enterprise") return "Pro";
  if (t === "starter") return "Starter";
  if (t === "free") return "Free";
  return "Unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const webhookUrl = Deno.env.get("MAKE_FEEDBACK_WEBHOOK_URL");
  if (!webhookUrl) {
    console.error("Missing MAKE_FEEDBACK_WEBHOOK_URL");
    return new Response(
      JSON.stringify({ error: "Feedback submission is not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

  try {
    const body = (await req.json()) as FeedbackSubmissionBody;
    const kind = body.kind === "contact" ? "contact" : "feedback";

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    let userId: string | null = null;
    let userEmail: string | null = null;
    let accessTier: string | null = null;

    if (authHeader?.startsWith("Bearer ") && authHeader !== `Bearer ${anonKey}`) {
      const authedClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error: userError,
      } = await authedClient.auth.getUser();
      if (!userError && user) {
        userId = user.id;
        userEmail = user.email ?? null;
        const { data: row } = await authedClient
          .from("users")
          .select("access_tier")
          .eq("id", user.id)
          .maybeSingle();
        accessTier = row?.access_tier ?? null;
      }
    }

    const needsTurnstile = !userId;

    if (needsTurnstile) {
      if (!TURNSTILE_SECRET_KEY) {
        console.error("Missing TURNSTILE_SECRET_KEY for unauthenticated submission");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (!body.turnstileToken) {
        return new Response(
          JSON.stringify({
            error: "Security verification required. Please complete the captcha.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const clientIp =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const turnstileFormData = new FormData();
      turnstileFormData.append("secret", TURNSTILE_SECRET_KEY);
      turnstileFormData.append("response", body.turnstileToken);
      turnstileFormData.append("remoteip", clientIp);
      const turnstileResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: turnstileFormData }
      );
      const turnstileResult: TurnstileResponse = await turnstileResponse.json();
      if (!turnstileResult.success) {
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
    }

    const createdAtIso = new Date().toISOString();

    let payload: Record<string, unknown>;

    if (kind === "contact") {
      if (!body.name?.trim() || !body.email?.trim() || !body.subject?.trim() || !body.message?.trim()) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: name, email, subject, message",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const notionType = mapInquiryToNotionType(body.inquiryType);
      const fullMessage =
        `${body.message.trim()}\n\n---\nName: ${body.name.trim()}\n` +
        `Inquiry type: ${body.inquiryType || "general"}`;
      payload = {
        title: body.subject.trim(),
        message: fullMessage,
        type: notionType,
        source: "In-app",
        userEmail: body.email.trim(),
        userTier: "Unknown",
        priority: "Normal",
        status: "New",
        createdAt: createdAtIso,
        createdAtIso,
        submissionContext: "contact_page",
        verifiedPro: false,
      };
    } else {
      if (!body.message?.trim()) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tier = userId ? mapDbTier(accessTier) : "Unknown";
      const notionType = normalizeFeedbackType(body.type);
      const title =
        (body.title && body.title.trim()) ||
        (body.message.trim().length > 80
          ? `${body.message.trim().slice(0, 77)}...`
          : body.message.trim());

      const isPro = tier === "Pro";
      const priority = isPro ? "High" : "Normal";

      payload = {
        title,
        message: body.message.trim(),
        type: notionType,
        source: "In-app",
        userEmail: userEmail ?? "",
        userTier: tier,
        priority,
        status: "New",
        createdAt: createdAtIso,
        createdAtIso,
        submissionContext: "studio_feedback",
        verifiedPro: isPro,
        userId: userId ?? "",
      };
    }

    const hookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!hookRes.ok) {
      const text = await hookRes.text();
      console.error("Make webhook error:", hookRes.status, text);
      return new Response(
        JSON.stringify({
          error: "Failed to submit feedback. Please try again.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Feedback received" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("feedback-submission error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred. Please try again.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
