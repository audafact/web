import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseCookieDomain } from "../routing/supabaseCookieDomain";

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
  const domain = getSupabaseCookieDomain(window.location.hostname);
  if (!domain) {
    return {};
  }
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
