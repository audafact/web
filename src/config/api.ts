// API Configuration — Worker routes live under /api/*. Vite may inject
// VITE_API_BASE_URL from .env or CI; never use localhost in production builds.
//
// Debug: set VITE_DEBUG_API_BASE=true at build time (Cloudflare Pages env) for step logs.
// Set VITE_KEEP_CONSOLE=true to keep all console.* in production bundles without verbose API logs.

/** True when VITE_DEBUG_API_BASE was set at build time (enables [Audafact API base] console warnings). */
export function isApiBaseDebugEnabled(): boolean {
  const v = import.meta.env.VITE_DEBUG_API_BASE;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "true" || s === "1";
}

function logApiBase(step: string, detail: Record<string, unknown>) {
  if (!isApiBaseDebugEnabled()) return;
  console.warn("[Audafact API base]", step, detail);
}

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

function isPageLocalhostLoopback(): boolean {
  if (typeof window === "undefined") return false;
  const hn = window.location.hostname.toLowerCase();
  return hn === "localhost" || hn === "127.0.0.1" || hn.endsWith(".localhost");
}

/**
 * Only a real browser session on the Vite dev host may use loopback in VITE_API_BASE_URL.
 * `vite build --mode staging` still sets PROD=true; hostname checks avoid baked localhost on real staging.
 */
function isLocalDevBrowserWhereLoopbackEnvIsValid(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.PROD) return false;
  const mode = import.meta.env.MODE;
  if (mode !== "development" && mode !== "staging") return false;
  return isPageLocalhostLoopback();
}

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

/** Persist last resolution for staging debugging; console only if VITE_KEEP_CONSOLE (see vite.config.js). */
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
  try {
    (window as Window & { __AUDAFACT_API_BASE_DEBUG__?: typeof payload }).__AUDAFACT_API_BASE_DEBUG__ =
      payload;
    sessionStorage.setItem("audafact_api_base_debug", JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
  logApiBase("resolve", { ...payload, result });
  if (
    String(import.meta.env.VITE_KEEP_CONSOLE || "")
      .toLowerCase()
      .trim() === "true"
  ) {
    console.info("[Audafact API base]", payload);
  }
}

const getBaseUrl = () => {
  const mode = import.meta.env.MODE;
  const host =
    typeof window !== "undefined" ? window.location.hostname : "(no window)";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "(no window)";

  logApiBase("start", {
    MODE: mode,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_API_BASE_URL_baked: import.meta.env.VITE_API_BASE_URL,
    hostname: host,
    origin,
    shouldUseStagingApiBase: shouldUseStagingApiBase(),
    isStagingBrowserHost: isStagingBrowserHost(),
  });

  let fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;

  // Drop baked loopback URLs unless we're actually on the Vite dev machine (localhost in the address bar).
  if (
    import.meta.env.PROD &&
    fromEnv &&
    (fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1"))
  ) {
    if (!isLocalDevBrowserWhereLoopbackEnvIsValid()) {
      logApiBase("strip localhost from baked URL in PROD", { before: fromEnv });
      fromEnv = undefined;
    }
  }

  // Browser hostname wins over baked VITE_API_BASE_URL (prod worker) for staging hosts — avoids CORS
  // when Cloudflare bakes prod URL or an old chunk mis-orders checks.
  if (typeof window !== "undefined") {
    const h = window.location.hostname.toLowerCase();
    const onStagingAudafact =
      h === "staging.audafact.com" || h.endsWith(".staging.audafact.com");
    const onStagingPages =
      h === "audafact-web-staging.pages.dev" ||
      h.endsWith(".audafact-web-staging.pages.dev");
    if (onStagingAudafact || onStagingPages) {
      if (
        fromEnv &&
        !isProductionWorkerApiUrl(fromEnv) &&
        !fromEnv.includes("localhost") &&
        !fromEnv.includes("127.0.0.1")
      ) {
        const out = normalizeApiBaseUrl(fromEnv);
        logApiBaseResolve("staging-host-browser-non-prod-env", out);
        return out;
      }
      const out = normalizeApiBaseUrl(STAGING_WORKER_API_BASE);
      logApiBaseResolve("staging-host-browser-default", out);
      return out;
    }
  }

  if (shouldUseStagingApiBase()) {
    if (fromEnv && !isProductionWorkerApiUrl(fromEnv)) {
      const out = normalizeApiBaseUrl(fromEnv);
      logApiBase("return staging branch: custom non-prod VITE_API_BASE_URL", {
        fromEnv,
        out,
      });
      logApiBaseResolve("shouldUseStaging-custom-env", out);
      return out;
    }
    const out = normalizeApiBaseUrl(STAGING_WORKER_API_BASE);
    logApiBase("return staging branch: STAGING_WORKER_API_BASE (ignore prod baked URL)", {
      fromEnv_was: fromEnv,
      out,
    });
    logApiBaseResolve("shouldUseStaging-default-staging-worker", out);
    return out;
  }

  // Browser dev: same-origin proxy must win over VITE_API_BASE_URL=http://localhost:8787/api
  // so .env never reintroduces mixed content or phone-localhost mistakes.
  if (
    typeof window !== "undefined" &&
    !import.meta.env.PROD &&
    (mode === "development" || mode === "staging")
  ) {
    const proxied = devBrowserApiBaseViaViteProxy();
    if (proxied) {
      logApiBase("return dev browser Vite proxy", { proxied, mode });
      logApiBaseResolve("dev-vite-proxy", proxied);
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
        logApiBase("return fromEnv→proxy rewrite", { proxied });
        logApiBaseResolve("fromEnv-proxy-rewrite", proxied);
        return proxied;
      }
    }
    const out = normalizeApiBaseUrl(fromEnv);
    logApiBase("return baked VITE_API_BASE_URL", { fromEnv, out });
    logApiBaseResolve("baked-vite-api-base-url", out);
    return out;
  }

  // Only the Vite dev server may use the proxy; never localhost in PROD builds
  // (including vite build --mode staging, where MODE is staging but PROD is true).
  if (!import.meta.env.PROD && (mode === "development" || mode === "staging")) {
    const devWorker =
      (import.meta.env.VITE_DEV_WORKER_API_URL as string | undefined)?.trim() ||
      DEFAULT_DEV_WORKER_API_BASE;
    const out = normalizeApiBaseUrl(devWorker);
    logApiBase("return dev default worker (non-browser or no proxy)", {
      devWorker,
      out,
    });
    logApiBaseResolve("dev-default-worker", out);
    return out;
  }

  logApiBase("return PRODUCTION_WORKER_API_BASE (fallback)", {
    reason:
      "shouldUseStagingApiBase was false and no earlier branch matched — check hostname vs isStagingBrowserHost()",
    PRODUCTION_WORKER_API_BASE,
  });
  logApiBaseResolve("production-fallback", PRODUCTION_WORKER_API_BASE);
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

/** Resolve worker API base at read time so browser hostname / session always match the live page. */
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
