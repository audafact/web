import { supabase } from "../services/supabase";
import { User } from "@supabase/supabase-js";

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

function isStagingPagesPreviewHost(hostname: string): boolean {
  return hostname
    .trim()
    .toLowerCase()
    .endsWith(".audafact-web-staging.pages.dev");
}

/** OAuth / email / password-reset callback URL (Supabase `redirectTo` / `emailRedirectTo`). */
export function getAuthRedirectUrl(): string {
  // LAN / *.local dev: never use a .env callback that points at localhost or prod —
  // Supabase must redirect back to the same host the user signed in from.
  if (import.meta.env.DEV) {
    return `${window.location.origin}/auth/callback`;
  }

  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() ?? "";
  if (configured.length > 0) {
    const isLocal =
      configured.includes("localhost") || configured.includes("127.0.0.1");
    if (
      isLocal &&
      (import.meta.env.VITE_APP_ENV === "staging" ||
        import.meta.env.VITE_APP_ENV === "production")
    ) {
      return `${window.location.origin}/auth/callback`;
    }
    return configured;
  }

  // Staging custom domain: complete OAuth on app host so PKCE + session cookies (.staging.audafact.com) align with studio.
  // Pages preview hostnames cannot share cookies with app.staging — keep callback on current origin.
  if (import.meta.env.VITE_APP_ENV === "staging") {
    const host =
      typeof window !== "undefined"
        ? window.location.hostname.trim().toLowerCase()
        : "";
    if (host && !isStagingPagesPreviewHost(host)) {
      return "https://app.staging.audafact.com/auth/callback";
    }
  }

  return `${window.location.origin}/auth/callback`;
}

function getOAuthRedirectUrl(): string {
  return getAuthRedirectUrl();
}

export const authService = {
  // Sign up with email and password
  async signUp(
    email: string,
    password: string,
    captchaToken?: string
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during sign up",
      };
    }
  },

  // Sign in with email and password
  async signIn(
    email: string,
    password: string,
    captchaToken?: string
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during sign in",
      };
    }
  },

  // Sign out
  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during sign out",
      };
    }
  },

  // Reset password
  async resetPassword(
    email: string,
    captchaToken?: string
  ): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(),
        ...(captchaToken ? { captchaToken } : {}),
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during password reset",
      };
    }
  },

  // Update password
  async updatePassword(password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred while updating password",
      };
    }
  },

  // Get current session
  async getSession() {
    return await supabase.auth.getSession();
  },

  // Sign in with Google
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      // OAuth redirects to Google, so we return success to indicate the flow started
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: "An unexpected error occurred during Google sign in",
      };
    }
  },
};
