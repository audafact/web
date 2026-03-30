import { supabase } from "../services/supabase";
import { User, isAuthError } from "@supabase/supabase-js";
import { isLocalBrowserDevHost } from "../routing/hostRouting";

/** User-visible MFA API errors; append setup hint when GoTrue returns 422. */
function mfaHttpErrorMessage(err: unknown, fallback: string): string {
  const base = isAuthError(err)
    ? err.message || fallback
    : err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : fallback;
  if (isAuthError(err) && err.status === 422) {
    return `${base} (HTTP 422: enable Authenticator/TOTP under Supabase → Authentication → MFA, or restart local Supabase after changing MFA config. If TOTP is already on, sign out and back in, then try again.)`;
  }
  return base;
}

/**
 * Last-resort wipe for @supabase/ssr cookie storage when API signOut fails (403 on global
 * revoke, corrupted session). Matches keys like `sb-<projectRef>-auth-token` and chunks.
 */
function clearSupabaseBrowserPersistence(): void {
  if (typeof window === "undefined") return;
  try {
    let storagePrefix = "sb-";
    try {
      const ref = new URL(
        import.meta.env.VITE_SUPABASE_URL || "https://x.supabase.co"
      ).hostname.split(".")[0];
      if (ref && ref !== "x") storagePrefix = `sb-${ref}`;
    } catch {
      /* ignore */
    }

    for (const store of [localStorage, sessionStorage]) {
      const toRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (
          k &&
          (k.startsWith(storagePrefix) ||
            k.startsWith("sb-") ||
            k.toLowerCase().includes("supabase"))
        ) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) store.removeItem(k);
    }

    if (document.cookie) {
      const names = new Set<string>();
      for (const part of document.cookie.split(";")) {
        const name = part.split("=")[0]?.trim();
        if (name) names.add(name);
      }
      for (const name of names) {
        if (name.startsWith("sb-") || name.toLowerCase().includes("supabase")) {
          document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
          document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/** Removes pending TOTP enrollments so POST /factors does not 422 on retry. */
async function removeUnverifiedTotpFactors(): Promise<void> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data?.all?.length) {
    return;
  }
  for (const f of data.all) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  /** After password sign-in: session is AAL1 and TOTP verification is required. */
  mfaRequired?: boolean;
  /** Verified TOTP factor IDs from the server; use with `verifyMfaLogin`. */
  mfaTotpFactorIds?: string[];
}

export interface MfaFactorsResult {
  success: boolean;
  error?: string;
  totp?: { id: string; friendly_name?: string; status: string }[];
}

export interface MfaEnrollTotpResult {
  success: boolean;
  error?: string;
  factorId?: string;
  /** Pass to img src as `data:image/svg+xml;utf-8,${qrCode}` */
  qrCode?: string;
  secret?: string;
}

function isStagingPagesPreviewHost(hostname: string): boolean {
  return hostname
    .trim()
    .toLowerCase()
    .endsWith(".audafact-web-staging.pages.dev");
}

/** True when the page host is loopback — not Bonjour `.local` or LAN IP. */
function isLoopbackDevHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return (
    h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]"
  );
}

/** OAuth / email / password-reset callback URL (Supabase `redirectTo` / `emailRedirectTo`). */
export function getAuthRedirectUrl(): string {
  const host =
    typeof window !== "undefined"
      ? window.location.hostname.trim().toLowerCase()
      : "";

  // 1) Explicit development build + 2) Vite dev server + 3) loopback/LAN-style hosts:
  // keep OAuth on `window.location.origin` so PKCE + cookies stay with the tab that
  // started sign-in. (`vite preview` has DEV=false but often MODE/VITE_APP_ENV=development;
  // a production `VITE_AUTH_REDIRECT_URL` must not send localhost to prod.)
  if (
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === "development" ||
    (host && isLocalBrowserDevHost(host))
  ) {
    const envPin = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() ?? "";
    if (envPin.length > 0 && host && isLocalBrowserDevHost(host)) {
      const pinLooksLocal =
        envPin.includes("localhost") ||
        envPin.includes("127.0.0.1") ||
        /\.local[/:]/.test(envPin);
      const pinRefsLoopback =
        envPin.includes("localhost") || envPin.includes("127.0.0.1");
      // Pinned `localhost` is for the dev machine’s browser. On a phone at
      // `*.local` or a LAN IP, `localhost` would mean the phone — use current origin.
      if (
        pinLooksLocal &&
        !(pinRefsLoopback && !isLoopbackDevHostname(host))
      ) {
        const url = envPin.includes("/callback")
          ? envPin
          : `${envPin.replace(/\/$/, "")}/auth/callback`;
        try {
          const pinProto = new URL(url).protocol;
          const pageProto =
            typeof window !== "undefined" ? window.location.protocol : "";
          if (pinProto === pageProto) {
            // #region agent log
            fetch(
              "/__agent-debug-log",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: "6faadc",
                  hypothesisId: "H1",
                  location: "authService.ts:getAuthRedirectUrl",
                  message: "branch dev_env_VITE_AUTH_REDIRECT_URL",
                  data: {
                    branch: "dev_env_pin",
                    url,
                    host,
                    pageOrigin:
                      typeof window !== "undefined"
                        ? window.location.origin
                        : null,
                  },
                  timestamp: Date.now(),
                }),
              },
            ).catch(() => {});
            // #endregion
            return url;
          }
        } catch {
          /* fall through to origin */
        }
      }
    }
    const url = `${window.location.origin}/auth/callback`;
    // #region agent log
    fetch(
      "/__agent-debug-log",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "6faadc",
          hypothesisId: "H1",
          location: "authService.ts:getAuthRedirectUrl",
          message: "branch dev_local_origin",
          data: {
            branch: "dev_local_origin",
            url,
            host,
            DEV: import.meta.env.DEV,
            MODE: import.meta.env.MODE,
            VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
            isLocalBrowserDevHost: !!(host && isLocalBrowserDevHost(host)),
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion
    return url;
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
      const u = `${window.location.origin}/auth/callback`;
      // #region agent log
      fetch(
        "/__agent-debug-log",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: "6faadc",
            hypothesisId: "H1",
            location: "authService.ts:getAuthRedirectUrl",
            message: "branch configured_local_override",
            data: {
              branch: "configured_local_override",
              url: u,
              configuredSnippet: configured.slice(0, 32),
              host,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      return u;
    }
    // #region agent log
    fetch(
      "/__agent-debug-log",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "6faadc",
          hypothesisId: "H1",
          location: "authService.ts:getAuthRedirectUrl",
          message: "branch configured VITE_AUTH_REDIRECT_URL",
          data: {
            branch: "configured",
            url: configured,
            host,
            VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion
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
      const url = "https://app.staging.audafact.com/auth/callback";
      // #region agent log
      fetch(
        "/__agent-debug-log",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: "6faadc",
            hypothesisId: "H1",
            location: "authService.ts:getAuthRedirectUrl",
            message: "branch staging_app_host",
            data: { branch: "staging_app_callback", url, host },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      return url;
    }
  }

  const fallback = `${window.location.origin}/auth/callback`;
  // #region agent log
  fetch(
    "/__agent-debug-log",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: "6faadc",
        hypothesisId: "H1",
        location: "authService.ts:getAuthRedirectUrl",
        message: "branch fallback origin",
        data: {
          branch: "fallback_origin",
          url: fallback,
          host,
          VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
        },
        timestamp: Date.now(),
      }),
    },
  ).catch(() => {});
  // #endregion
  return fallback;
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

      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        return {
          success: false,
          error: aalError.message,
        };
      }

      if (
        aalData?.currentLevel === "aal1" &&
        aalData?.nextLevel === "aal2"
      ) {
        const { data: factorData, error: factorError } =
          await supabase.auth.mfa.listFactors();
        if (factorError) {
          return {
            success: false,
            error: factorError.message,
          };
        }
        const mfaTotpFactorIds = (factorData?.totp ?? []).map((f) => f.id);
        return {
          success: true,
          mfaRequired: true,
          mfaTotpFactorIds,
          user: data.user ?? undefined,
        };
      }

      return {
        success: true,
        user: data.user || undefined,
      };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred during sign in",
      };
    }
  },

  /**
   * Complete MFA after `signIn` returned `mfaRequired: true`.
   * Uses the first challenge + verify cycle for the given TOTP factor.
   */
  async verifyMfaLogin(factorId: string, code: string): Promise<AuthResponse> {
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError || !challengeData) {
        return {
          success: false,
          error: challengeError?.message ?? "MFA challenge failed",
        };
      }

      const { data: verifyData, error: verifyError } =
        await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code: code.trim(),
        });

      if (verifyError || !verifyData) {
        return {
          success: false,
          error: verifyError?.message ?? "Invalid verification code",
        };
      }

      return {
        success: true,
        user: verifyData.user,
      };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred during MFA verification",
      };
    }
  },

  async listMfaFactors(): Promise<MfaFactorsResult> {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        return {
          success: false,
          error: mfaHttpErrorMessage(error, "Could not list MFA factors"),
        };
      }
      return {
        success: true,
        totp: data.totp.map((f) => ({
          id: f.id,
          friendly_name: f.friendly_name,
          status: f.status,
        })),
      };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred while listing MFA factors",
      };
    }
  },

  async enrollTotpMfa(friendlyName = "Authenticator app"): Promise<MfaEnrollTotpResult> {
    try {
      await removeUnverifiedTotpFactors();

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });

      if (error || !data) {
        return {
          success: false,
          error: mfaHttpErrorMessage(
            error,
            "Could not start MFA enrollment"
          ),
        };
      }

      return {
        success: true,
        factorId: data.id,
        /** Already a usable `img` src when prefixed by auth-js (`data:image/svg+xml;utf-8,...`). */
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred during MFA enrollment",
      };
    }
  },

  async completeTotpEnrollment(
    factorId: string,
    code: string
  ): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

      if (error || !data) {
        return {
          success: false,
          error: error?.message ?? "Could not verify the code",
        };
      }

      return {
        success: true,
        user: data.user,
      };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred while completing MFA enrollment",
      };
    }
  },

  async unenrollMfaFactor(factorId: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return { success: true };
    } catch {
      return {
        success: false,
        error: "An unexpected error occurred while removing MFA",
      };
    }
  },

  // Sign out
  async signOut(): Promise<AuthResponse> {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      /* global revoke often 403 if refresh token is already invalid */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* continue to wipe */
    }
    clearSupabaseBrowserPersistence();
    return { success: true };
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
      const redirectTo = getOAuthRedirectUrl();
      // #region agent log
      fetch(
        "/__agent-debug-log",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: "6faadc",
            hypothesisId: "H5",
            location: "authService.ts:signInWithGoogle",
            message: "signInWithOAuth redirectTo",
            data: {
              redirectTo,
              pageOrigin:
                typeof window !== "undefined" ? window.location.origin : null,
              pageHost:
                typeof window !== "undefined"
                  ? window.location.hostname
                  : null,
            },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
      const oauth = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      // #region agent log
      try {
        const authorizeUrl = oauth.data?.url ?? null;
        let redirectToParam: string | null = null;
        if (authorizeUrl) {
          const u = new URL(authorizeUrl);
          redirectToParam = u.searchParams.get("redirect_to");
        }
        fetch("/__agent-debug-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "6faadc",
            hypothesisId: "H6",
            location: "authService.ts:signInWithGoogle after OAuth",
            message: "authorize URL redirect_to param",
            data: {
              requestedRedirectTo: redirectTo,
              authorizeUrlHost: authorizeUrl ? new URL(authorizeUrl).host : null,
              redirectToInAuthorizeUrl: redirectToParam,
              oauthError: oauth.error?.message ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
      // #endregion
      const error = oauth.error;

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
