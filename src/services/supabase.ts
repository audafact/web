import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseCookieDomain } from "../routing/supabaseCookieDomain";
import { isLocalBrowserDevHost } from "../routing/hostRouting";

// Use environment variables or fallback to development values
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";

// Only throw error in production
if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("Missing Supabase environment variables");
}

function getBrowserClientOptions(): {
  cookieOptions?: {
    domain: string;
    path: string;
    sameSite: "lax";
    secure: boolean;
  };
} {
  if (typeof window === "undefined") {
    return {};
  }
  const hostname = window.location.hostname.trim().toLowerCase();
  // Never scope auth cookies to `.audafact.com` during local/dev: if the hostname
  // ever matches prod patterns (tunnel, /etc/hosts), a parent-domain cookie breaks
  // PKCE/session on localhost and looks like "signed in on prod but not here".
  const hostOnlyAuthCookies =
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === "development" ||
    isLocalBrowserDevHost(hostname);
  if (hostOnlyAuthCookies) {
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
          hypothesisId: "H4",
          location: "supabase.ts:getBrowserClientOptions",
          message: "host-only auth cookies",
          data: {
            hostOnlyAuthCookies: true,
            hostname,
            DEV: import.meta.env.DEV,
            VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion
    return {};
  }
  const domain = getSupabaseCookieDomain(hostname);
  if (!domain) {
    return {};
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
        hypothesisId: "H4",
        location: "supabase.ts:getBrowserClientOptions",
        message: "parent-domain cookieOptions",
        data: {
          hostOnlyAuthCookies: false,
          hostname,
          cookieDomain: domain,
          VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
        },
        timestamp: Date.now(),
      }),
    },
  ).catch(() => {});
  // #endregion
  return {
    cookieOptions: {
      domain,
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    },
  };
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  getBrowserClientOptions(),
);
