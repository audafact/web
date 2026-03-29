// API Configuration — Worker routes live under /api/*. Vite may inject
// VITE_API_BASE_URL from .env or CI; never use localhost in production builds.
const PRODUCTION_WORKER_API_BASE =
  "https://audafact-api.david-g-cortinas.workers.dev/api";

export const STAGING_WORKER_API_BASE =
  "https://audafact-api-staging.david-g-cortinas.workers.dev/api";

/** True when URL targets prod API worker (not audafact-api-staging). */
export function isProductionWorkerApiUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes("audafact-api-staging")) return false;
  return u.includes("audafact-api.david-g-cortinas.workers.dev");
}

/** Ensure direct Worker URLs include /api; keep Vite dev proxy base unchanged. */
export function normalizeApiBaseUrl(raw: string): string {
  const base = raw.replace(/\/$/, "");
  // Local dev proxy: /api/staging → worker /api (see vite.config.js)
  if (base.includes("/api/staging")) {
    return base;
  }
  // *.workers.dev hosts serve API at /api/*
  if (base.includes(".workers.dev") && !base.endsWith("/api")) {
    return `${base}/api`;
  }
  return base;
}

/**
 * True when the page is served from a staging web host.
 * Cloudflare Pages often builds with NODE_ENV=production and no VITE_APP_ENV=staging;
 * host detection is the reliable signal for which worker to call.
 *
 * Uses strict regex so we match apex `staging.audafact.com` and `*.staging.audafact.com`
 * without false positives (e.g. a label ending in "notstaging").
 */
export function isStagingBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  if (/(^|\.)staging\.audafact\.com$/.test(h)) return true;
  if (/(^|\.)audafact-web-staging\.pages\.dev$/.test(h)) return true;
  return false;
}

/**
 * Use staging Worker API when the bundle is built for staging or the page is on a staging host.
 * Relying on hostname alone misses apex `*.pages.dev` URLs and some preview hosts.
 */
export function shouldUseStagingApiBase(): boolean {
  if (
    String(import.meta.env.VITE_USE_STAGING_API || "")
      .toLowerCase()
      .trim() === "true"
  ) {
    return true;
  }
  const appEnv = import.meta.env.VITE_APP_ENV as string | undefined;
  if (appEnv === "staging") return true;
  return isStagingBrowserHost();
}

/** Dev server proxy path; must match vite.config.js `proxy` key. */
const DEV_STAGING_PROXY_PREFIX = "/api/staging";

/**
 * Local wrangler dev (Node / non-browser). The browser always uses the Vite proxy
 * (same origin) so HTTPS dev + HTTP :8787 never hits mixed-content blocking.
 */
const DEFAULT_DEV_WORKER_API_BASE = "http://localhost:8787/api";

/**
 * In Vite dev/staging mode, call the worker through the dev server proxy so:
 * - https://localhost:5173 can reach the API without mixed content
 * - phones on LAN use the laptop's origin, not http://localhost:8787 on the device
 */
const devBrowserApiBaseViaViteProxy = (): string | undefined => {
  if (import.meta.env.PROD || typeof window === "undefined") return undefined;
  const origin = window.location?.origin;
  if (!origin) return undefined;
  return normalizeApiBaseUrl(`${origin}${DEV_STAGING_PROXY_PREFIX}`);
};

// #region agent log
/** Debug: trace which branch selected the Worker API base (staging CORS investigation). */
function logApiBaseResolve(branch: string, result: string): void {
  if (typeof window === "undefined") return;
  const h = window.location.hostname.toLowerCase();
  const payload = {
    branch,
    resultPrefix: result.slice(0, 100),
    host: h,
    pathname: window.location.pathname,
    viteUseStaging: String(import.meta.env.VITE_USE_STAGING_API ?? ""),
    viteAppEnv: String(import.meta.env.VITE_APP_ENV ?? ""),
    viteApiBasePrefix: String(import.meta.env.VITE_API_BASE_URL ?? "").slice(
      0,
      80
    ),
    mode: String(import.meta.env.MODE),
    prod: import.meta.env.PROD,
    isStagingHost: isStagingBrowserHost(),
    shouldUseStaging: shouldUseStagingApiBase(),
    regexStagingAudafact: /(^|\.)staging\.audafact\.com$/.test(h),
    regexStagingPages: /(^|\.)audafact-web-staging\.pages\.dev$/.test(h),
    t: Date.now(),
  };
  // Staging HTTPS cannot POST to localhost ingest (blocked); production build strips console.* (terser).
  try {
    (window as Window & { __AUDAFACT_API_BASE_DEBUG__?: typeof payload }).__AUDAFACT_API_BASE_DEBUG__ =
      payload;
    sessionStorage.setItem("audafact_api_base_debug", JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
  fetch("http://127.0.0.1:7242/ingest/10e4759a-d96b-49b3-bfb4-de256f0de7a3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "fa003a",
    },
    body: JSON.stringify({
      sessionId: "fa003a",
      timestamp: Date.now(),
      location: "api.ts:getBaseUrl",
      message: "api_base_resolve",
      hypothesisId: "H1-H5",
      data: payload,
    }),
  }).catch(() => {});
}
// #endregion

const getBaseUrl = () => {
  let fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  if (
    import.meta.env.PROD &&
    fromEnv &&
    (fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1"))
  ) {
    fromEnv = undefined;
  }

  if (shouldUseStagingApiBase()) {
    if (fromEnv && !isProductionWorkerApiUrl(fromEnv)) {
      const out = normalizeApiBaseUrl(fromEnv);
      // #region agent log
      logApiBaseResolve("staging-non-prod-from-env", out);
      // #endregion
      return out;
    }
    const out = normalizeApiBaseUrl(STAGING_WORKER_API_BASE);
    // #region agent log
    logApiBaseResolve("staging-default-worker", out);
    // #endregion
    return out;
  }

  const mode = import.meta.env.MODE;

  // Browser dev: same-origin proxy must win over VITE_API_BASE_URL=http://localhost:8787/api
  // so .env never reintroduces mixed content or phone-localhost mistakes.
  if (
    typeof window !== "undefined" &&
    !import.meta.env.PROD &&
    (mode === "development" || mode === "staging")
  ) {
    const proxied = devBrowserApiBaseViaViteProxy();
    if (proxied) {
      // #region agent log
      logApiBaseResolve("dev-vite-proxy", proxied);
      // #endregion
      return proxied;
    }
  }

  if (fromEnv) {
    if (
      !import.meta.env.PROD &&
      fromEnv.includes(DEV_STAGING_PROXY_PREFIX) &&
      /\blocalhost\b|127\.0\.0\.1/.test(fromEnv)
    ) {
      const proxied = devBrowserApiBaseViaViteProxy();
      if (proxied) {
        // #region agent log
        logApiBaseResolve("dev-vite-proxy-from-env", proxied);
        // #endregion
        return proxied;
      }
    }
    const out = normalizeApiBaseUrl(fromEnv);
    // #region agent log
    logApiBaseResolve("baked-from-env-fallback", out);
    // #endregion
    return out;
  }

  // Only the Vite dev server may use the proxy; never localhost in PROD builds
  // (including vite build --mode staging, where MODE is staging but PROD is true).
  if (
    !import.meta.env.PROD &&
    (mode === "development" || mode === "staging")
  ) {
    const devWorker =
      (import.meta.env.VITE_DEV_WORKER_API_URL as string | undefined)?.trim() ||
      DEFAULT_DEV_WORKER_API_BASE;
    const out = normalizeApiBaseUrl(devWorker);
    // #region agent log
    logApiBaseResolve("dev-default-worker", out);
    // #endregion
    return out;
  }

  // #region agent log
  logApiBaseResolve("production-worker-fallback", PRODUCTION_WORKER_API_BASE);
  // #endregion
  return PRODUCTION_WORKER_API_BASE;
};

const API_ENDPOINTS = {
  SIGN_UPLOAD: "/sign-upload",
  ANALYTICS: "/analytics",
  ANALYTICS_CREATIVE_METRICS: "/analytics/creative-metrics",
  ANALYTICS_FUNNEL: "/analytics/funnel",
  ANALYTICS_EARLY_WARNINGS: "/analytics/early-warnings",
  TRIGGER_ANALYSIS: "/trigger-analysis",
} as const;

const API_TIMEOUTS = {
  UPLOAD: 30000,
  REQUEST: 10000,
} as const;

/** Resolve worker API base at read time so browser hostname / env always match the live page. */
export const API_CONFIG = {
  get BASE_URL(): string {
    return getBaseUrl();
  },
  ENDPOINTS: API_ENDPOINTS,
  TIMEOUTS: API_TIMEOUTS,
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${getBaseUrl()}${endpoint}`;
};

// #region agent log
/** Force one getBaseUrl resolution on load (assignment keeps side effects from being tree-shaken). */
if (typeof window !== "undefined") {
  queueMicrotask(() => {
    try {
      (window as Window & { __AUDAFACT_API_BASE_PROBE__?: string }).__AUDAFACT_API_BASE_PROBE__ =
        API_CONFIG.BASE_URL;
    } catch {
      /* ignore */
    }
  });
}
// #endregion
