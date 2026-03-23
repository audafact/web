import { supabase } from "./supabase";

interface RedeemInviteCodeResult {
  success: boolean;
  message: string;
  tier?: "pro";
  expires_at?: string | null;
}

export const redeemInviteCode = async (code: string): Promise<RedeemInviteCodeResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("redeem-invite-code", {
      body: { code },
    });

    if (error) {
      return {
        success: false,
        message: (data as { message?: string })?.message || error.message || "Failed to redeem code",
      };
    }

    return {
      success: Boolean(data?.success),
      message: data?.message || "Invite code redeemed.",
      tier: data?.tier,
      expires_at: data?.expires_at ?? null,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to redeem code",
    };
  }
};
