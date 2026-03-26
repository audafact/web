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

const getBaseUrl = () => {
  let fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const appEnv = import.meta.env.VITE_APP_ENV as string | undefined;

  if (
    import.meta.env.PROD &&
    fromEnv &&
    (fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1"))
  ) {
    fromEnv = undefined;
  }

  // Pages / CI sometimes set a single VITE_API_BASE_URL to prod; staging origin would hit CORS.
  if (appEnv === "staging" && fromEnv && isProductionWorkerApiUrl(fromEnv)) {
    fromEnv = undefined;
  }

  if (fromEnv) {
    return normalizeApiBaseUrl(fromEnv);
  }

  const mode = import.meta.env.MODE;

  // Only the Vite dev server may use the proxy; never localhost in PROD builds
  // (including vite build --mode staging, where MODE is staging but PROD is true).
  if (
    !import.meta.env.PROD &&
    (mode === "development" || mode === "staging")
  ) {
    return "http://localhost:5173/api/staging";
  }

  if (appEnv === "staging") {
    return normalizeApiBaseUrl(STAGING_WORKER_API_BASE);
  }

  return PRODUCTION_WORKER_API_BASE;
};

export const API_CONFIG = {
  // Base URL for the API service
  BASE_URL: getBaseUrl(),

  // Endpoints (relative to BASE_URL)
  ENDPOINTS: {
    SIGN_UPLOAD: "/sign-upload",
    ANALYTICS: "/analytics",
    ANALYTICS_CREATIVE_METRICS: "/analytics/creative-metrics",
    ANALYTICS_FUNNEL: "/analytics/funnel",
    ANALYTICS_EARLY_WARNINGS: "/analytics/early-warnings",
    TRIGGER_ANALYSIS: "/trigger-analysis",
  },

  // Timeouts
  TIMEOUTS: {
    UPLOAD: 30000, // 30 seconds for upload operations
    REQUEST: 10000, // 10 seconds for general requests
  },
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
