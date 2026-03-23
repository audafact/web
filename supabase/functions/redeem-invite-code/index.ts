import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RedeemInviteCodeRequest {
  code?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Missing auth token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { code } = (await req.json()) as RedeemInviteCodeRequest;
    const normalizedCode = (code ?? "").trim().toUpperCase();
    if (!normalizedCode) {
      return new Response(JSON.stringify({ success: false, message: "Invite code is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { data: inviteCode, error: inviteError } = await adminClient
      .from("invite_codes")
      .select("id, code, is_active, expires_at, max_redemptions, redemption_count")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (inviteError) {
      throw new Error(`Failed to validate code: ${inviteError.message}`);
    }

    if (!inviteCode || !inviteCode.is_active) {
      return new Response(JSON.stringify({ success: false, message: "Invalid invite code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (inviteCode.expires_at && new Date(inviteCode.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, message: "This invite code has expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (
      inviteCode.max_redemptions !== null &&
      inviteCode.redemption_count >= inviteCode.max_redemptions
    ) {
      return new Response(JSON.stringify({ success: false, message: "This invite code is fully redeemed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { data: existingRedemption } = await adminClient
      .from("invite_code_redemptions")
      .select("id")
      .eq("invite_code_id", inviteCode.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingRedemption) {
      const { error: redemptionError } = await adminClient
        .from("invite_code_redemptions")
        .insert({ invite_code_id: inviteCode.id, user_id: user.id });

      if (redemptionError) {
        throw new Error(`Failed to record redemption: ${redemptionError.message}`);
      }

      const { error: incrementError } = await adminClient.rpc("increment_invite_code_redemption_count", {
        p_invite_code_id: inviteCode.id,
      });
      if (incrementError) {
        throw new Error(`Failed to increment redemption count: ${incrementError.message}`);
      }
    }

    const expireDays = Number(Deno.env.get("INVITE_PRO_DURATION_DAYS") ?? "45");
    const expiresAt = Number.isFinite(expireDays) && expireDays > 0
      ? new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: upgradeError } = await adminClient
      .from("users")
      .update({
        access_tier: "pro",
        pro_access_source: "invite_code",
        pro_expires_at: expiresAt,
      })
      .eq("id", user.id);

    if (upgradeError) {
      throw new Error(`Failed to upgrade account: ${upgradeError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pro unlocked. Welcome to the early creator group.",
        tier: "pro",
        expires_at: expiresAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ success: false, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
