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
 */
export function isStagingBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h === "staging.audafact.com" ||
    h.endsWith(".staging.audafact.com") ||
    /** Apex Pages host is `project.pages.dev`, not `*.project.pages.dev`. */
    h === "audafact-web-staging.pages.dev" ||
    h.endsWith(".audafact-web-staging.pages.dev")
  );
}

/**
 * Use staging Worker API when the bundle is built for staging or the page is on a staging host.
 * Relying on hostname alone misses apex `*.pages.dev` URLs and some preview hosts.
 */
export function shouldUseStagingApiBase(): boolean {
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
      return normalizeApiBaseUrl(fromEnv);
    }
    return normalizeApiBaseUrl(STAGING_WORKER_API_BASE);
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
    if (proxied) return proxied;
  }

  if (fromEnv) {
    if (
      !import.meta.env.PROD &&
      fromEnv.includes(DEV_STAGING_PROXY_PREFIX) &&
      /\blocalhost\b|127\.0\.0\.1/.test(fromEnv)
    ) {
      const proxied = devBrowserApiBaseViaViteProxy();
      if (proxied) return proxied;
    }
    return normalizeApiBaseUrl(fromEnv);
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
    return normalizeApiBaseUrl(devWorker);
  }

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
