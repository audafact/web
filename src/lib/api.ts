// web/src/lib/api.ts
// sign-file rate limits: free=100/hour, pro=1000/hour. All track loads and library
// previews share "preview" quota. Caching + coalescing reduce redundant requests.
import {
  STAGING_WORKER_API_BASE,
  isProductionWorkerApiUrl,
  isStagingBrowserHost,
  normalizeApiBaseUrl,
} from "@/config/api";
import { supabase } from "@/services/supabase";

function computeApiBase(): string {
  if (import.meta.env.DEV) {
    return "http://localhost:5173/api/staging";
  }

  const appEnv = import.meta.env.VITE_APP_ENV as string | undefined;
  let envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (
    import.meta.env.PROD &&
    envUrl &&
    (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))
  ) {
    envUrl = undefined;
  }

  if (isStagingBrowserHost()) {
    if (envUrl && !isProductionWorkerApiUrl(envUrl)) {
      return normalizeApiBaseUrl(envUrl);
    }
    return STAGING_WORKER_API_BASE;
  }

  if (appEnv === "staging" && envUrl && isProductionWorkerApiUrl(envUrl)) {
    envUrl = undefined;
  }
  if (envUrl) {
    return normalizeApiBaseUrl(envUrl);
  }
  if (appEnv === "staging") {
    return STAGING_WORKER_API_BASE;
  }
  return "https://audafact-api.david-g-cortinas.workers.dev/api";
}

/** Worker REST base including `/api` — recomputed per call so it matches runtime host. */
export function getApiBase(): string {
  return computeApiBase();
}

const signFileRetryDelay = 2000;
/** Signed URLs from Worker are valid 90s; cache for 75s to avoid using expired URLs */
const SIGNED_URL_CACHE_TTL_MS = 75_000;

// Cache: key -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
// Coalesce in-flight requests: key -> Promise<string>
const signFileInFlight = new Map<string, Promise<string>>();

async function signFileInternal(key: string, retryCount: number): Promise<string> {
  const sessionResult = await supabase.auth.getSession();
  const { data: s } = sessionResult || {};
  const token = s?.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const r = await fetch(
    `${getApiBase()}/sign-file?key=${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (r.status === 429 && retryCount < 2) {
    const delay = signFileRetryDelay * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return signFileInternal(key, retryCount + 1);
  }

  if (!r.ok) throw new Error(`sign-file failed: ${r.status}`);
  const { url } = await r.json();
  return url as string;
}

/** Clears in-memory sign-file caches (use between Vitest cases). */
export function resetSignFileStateForTests() {
  signedUrlCache.clear();
  signFileInFlight.clear();
}

export async function signFile(key: string, retryCount = 0): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const inFlight = signFileInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = signFileInternal(key, retryCount)
    .then((url) => {
      signedUrlCache.set(key, {
        url,
        expiresAt: now + SIGNED_URL_CACHE_TTL_MS,
      });
      return url;
    })
    .finally(() => {
      signFileInFlight.delete(key);
    });
  signFileInFlight.set(key, promise);

  return promise;
}

/** Get auth headers for API calls (Bearer token from Supabase session) */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
