import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InsertPayload {
  type: "INSERT";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let out = 0;
  for (let i = 0; i < bufA.length; i++) out |= bufA[i]! ^ bufB[i]!;
  return out === 0;
}

function verifyWebhookSecret(req: Request, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  return timingSafeEqual(auth, expected);
}

function isInsertPayload(body: unknown): body is InsertPayload {
  if (!body || typeof body !== "object") return false;
  const o = body as InsertPayload;
  return (
    o.type === "INSERT" &&
    o.schema === "public" &&
    o.table === "users" &&
    o.old_record === null &&
    o.record !== null &&
    typeof o.record === "object"
  );
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

  const webhookSecret = Deno.env.get("DATABASE_WEBHOOK_SECRET");
  if (webhookSecret && !verifyWebhookSecret(req, webhookSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL");
  const resendFrom =
    Deno.env.get("RESEND_FROM")?.trim() || "Audafact <onboarding@resend.dev>";

  if (!resendKey || !adminEmail) {
    console.error("Missing RESEND_API_KEY or ADMIN_NOTIFY_EMAIL");
    return new Response(
      JSON.stringify({ error: "Notification is not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRole) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isInsertPayload(body)) {
    return new Response(JSON.stringify({ error: "Unexpected payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = body.record.id;
  if (typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "Missing user id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(userId);

  if (userError || !userData?.user) {
    console.error("getUserById failed:", userError?.message ?? "no user");
    return new Response(JSON.stringify({ error: "User lookup failed" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signupEmail = userData.user.email ?? "(no email)";
  const accessTier =
    typeof body.record.access_tier === "string"
      ? body.record.access_tier
      : "unknown";
  const createdAt =
    typeof body.record.created_at === "string"
      ? body.record.created_at
      : String(body.record.created_at ?? "");

  const text = [
    "A new user was created in Audafact.",
    "",
    `User id: ${userId}`,
    `Email: ${signupEmail}`,
    `Access tier: ${accessTier}`,
    `public.users created_at: ${createdAt}`,
    "",
    `Auth created_at: ${userData.user.created_at ?? ""}`,
  ].join("\n");

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [adminEmail],
      subject: `New Audafact signup: ${signupEmail}`,
      text,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error("Resend error:", resendRes.status, errText);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
