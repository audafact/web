// web/src/lib/api.ts
// sign-file rate limits: free=100/hour, pro=1000/hour. All track loads and library
// previews share "preview" quota. Caching + coalescing reduce redundant requests.
import { API_CONFIG, isApiBaseDebugEnabled } from "@/config/api";
import { supabase } from "@/services/supabase";

/** Worker REST base including `/api` — recomputed per call so it matches runtime host. */
export function getApiBase(): string {
  return API_CONFIG.BASE_URL;
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

  const base = getApiBase();
  const signUrl = `${base}/sign-file?key=${encodeURIComponent(key)}`;
  if (isApiBaseDebugEnabled()) {
    console.warn("[Audafact API] sign-file fetch", {
      base,
      signUrl,
      key,
      hostname:
        typeof window !== "undefined" ? window.location.hostname : "(no window)",
    });
  }

  const r = await fetch(signUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

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

const streamRetryDelayMs = 2000;

/**
 * Download audio bytes via Worker GET /stream (same-origin / CORS-safe).
 * Use this instead of sign-file + fetch(presignedUrl) in the browser so R2 bucket CORS is not required.
 */
export async function fetchLibraryAudioBlob(
  fileKey: string,
  retryCount = 0
): Promise<Blob> {
  const sessionResult = await supabase.auth.getSession();
  const token = sessionResult?.data?.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const base = getApiBase();
  const streamUrl = `${base}/stream?key=${encodeURIComponent(fileKey)}`;
  if (isApiBaseDebugEnabled()) {
    console.warn("[Audafact API] stream fetch", {
      base,
      streamUrl,
      fileKey,
      hostname:
        typeof window !== "undefined" ? window.location.hostname : "(no window)",
    });
  }

  const r = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (r.status === 429 && retryCount < 2) {
    const delay = streamRetryDelayMs * 2 ** retryCount;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchLibraryAudioBlob(fileKey, retryCount + 1);
  }

  if (!r.ok) {
    let detail = "";
    try {
      const j = (await r.json()) as { error?: string };
      detail = j.error || "";
    } catch {
      detail = await r.text().catch(() => "");
    }
    if (r.status === 429) {
      throw new Error(
        "Too many requests. Please wait a moment and try again."
      );
    }
    throw new Error(detail || `Audio stream failed: ${r.status}`);
  }

  return r.blob();
}
