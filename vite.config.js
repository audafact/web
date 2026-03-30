import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { getEnvironmentConfig } from "./config/environments.js";

/** Append agent debug NDJSON lines (browser POSTs same-origin to avoid CORS on ingest). */
function agentDebugLogPlugin() {
  const logFile = path.resolve(__dirname, "../.cursor/debug-6faadc.log");
  return {
    name: "agent-debug-log",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const pathOnly = req.url?.split("?")[0] ?? "";
          if (
            pathOnly === "/auth/callback" ||
            pathOnly.startsWith("/auth/callback/")
          ) {
            fs.mkdirSync(path.dirname(logFile), { recursive: true });
            fs.appendFileSync(
              logFile,
              `${JSON.stringify({
                hypothesisId: "H11",
                location: "vite.devServer",
                message: "incoming HTTP to /auth/callback",
                data: {
                  method: req.method,
                  path: pathOnly,
                  host: req.headers.host,
                },
                timestamp: Date.now(),
              })}\n`,
              "utf8",
            );
          }
        } catch {
          /* ignore */
        }
        next();
      });
      server.middlewares.use("/__agent-debug-log", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          try {
            const line = Buffer.concat(chunks).toString("utf8").trim();
            if (line) {
              fs.mkdirSync(path.dirname(logFile), { recursive: true });
              fs.appendFileSync(logFile, `${line}\n`, "utf8");
            }
          } catch (_) {
            /* ignore */
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

/** Non-empty shell/CI env wins over .env so `VITE_APP_ENV=staging npm run build:staging` is not overwritten by VITE_APP_ENV=development from a local file (which baked localhost proxy URLs into staging). */
function pickViteEnvPreferShell(key, loaded) {
  const shell = process.env[key];
  if (shell !== undefined && shell !== "") return shell;
  return loaded[key];
}

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), "");

  const resolvedViteAppEnv = pickViteEnvPreferShell("VITE_APP_ENV", env);
  if (resolvedViteAppEnv) {
    process.env.VITE_APP_ENV = resolvedViteAppEnv;
  }

  // Get environment configuration
  const envConfig = getEnvironmentConfig();

  const appEnv =
    resolvedViteAppEnv ||
    envConfig.name?.toLowerCase() ||
    "";

  const envTruthy = (v) =>
    String(v || "")
      .toLowerCase()
      .trim() === "true" ||
    String(v || "").trim() === "1";
  /** Preserve console.* in production bundles (Terser). Set in Cloudflare Pages or .env for staging debug. */
  const keepConsole =
    envTruthy(env.VITE_KEEP_CONSOLE) || envTruthy(process.env.VITE_KEEP_CONSOLE);
  /** Verbose [Audafact API base] resolution logs in src/config/api.ts */
  const debugApiBase =
    envTruthy(env.VITE_DEBUG_API_BASE) || envTruthy(process.env.VITE_DEBUG_API_BASE);
  const preserveConsoleInBuild = keepConsole || debugApiBase;

  let resolvedApiUrl =
    pickViteEnvPreferShell("VITE_API_BASE_URL", env) || envConfig.apiUrl;

  const cfPagesUrl = (process.env.CF_PAGES_URL || "").toLowerCase();
  const deployLooksLikeStagingWeb =
    cfPagesUrl.includes("staging.audafact.com") ||
    cfPagesUrl.includes("audafact-web-staging.pages.dev");

  // Never bake localhost API base for deployed envs (local .env / Pages env mistakes).
  // If VITE_APP_ENV=development is set by mistake on Cloudflare Pages, still strip loopback.
  const isCloudflarePagesBuild = process.env.CF_PAGES === "1";
  if (
    resolvedApiUrl &&
    (resolvedApiUrl.includes("localhost") ||
      resolvedApiUrl.includes("127.0.0.1"))
  ) {
    if (appEnv !== "development" || isCloudflarePagesBuild) {
      resolvedApiUrl = envConfig.apiUrl;
    }
  }
  // Cloudflare Pages often sets one VITE_API_BASE_URL for all branches → prod worker URL baked while the
  // site is served from staging hosts = CORS failure. CF_PAGES_URL detects staging deployments even when
  // getEnvironment() resolves to "preview" (non-default branch).
  const stagingWorkerApiBaked =
    "https://audafact-api-staging.david-g-cortinas.workers.dev/api";
  if (
    (appEnv === "staging" || deployLooksLikeStagingWeb) &&
    resolvedApiUrl &&
    resolvedApiUrl.includes("audafact-api.david-g-cortinas.workers.dev") &&
    !resolvedApiUrl.includes("audafact-api-staging")
  ) {
    resolvedApiUrl = stagingWorkerApiBaked;
  }
  // Worker hosts use /api/* — match runtime normalizeApiBaseUrl in src/config/api.ts
  if (
    resolvedApiUrl &&
    resolvedApiUrl.includes(".workers.dev") &&
    !resolvedApiUrl.includes("/api/staging")
  ) {
    const t = resolvedApiUrl.replace(/\/$/, "");
    if (!t.endsWith("/api")) {
      resolvedApiUrl = `${t}/api`;
    }
  }

  // Generate environment variables for Vite
  // Never bake localhost callbacks into staging/production (breaks OAuth if .env / CI leaks dev URLs).
  let authRedirectUrl =
    env.VITE_AUTH_REDIRECT_URL || process.env.VITE_AUTH_REDIRECT_URL || "";
  if (
    (appEnv === "staging" || appEnv === "production") &&
    authRedirectUrl &&
    (authRedirectUrl.includes("localhost") ||
      authRedirectUrl.includes("127.0.0.1"))
  ) {
    authRedirectUrl = "";
  }

  const viteEnvVars = {
    VITE_API_BASE_URL: resolvedApiUrl,
    VITE_TURNSTILE_SITE_KEY:
      env.VITE_TURNSTILE_SITE_KEY || envConfig.turnstileSiteKey,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || envConfig.supabaseUrl,
    VITE_SUPABASE_ANON_KEY:
      env.VITE_SUPABASE_ANON_KEY || envConfig.supabaseAnonKey,
    VITE_STRIPE_MODE: env.VITE_STRIPE_MODE || envConfig.stripeMode,
    VITE_STRIPE_TEST_PRODUCT_MONTHLY:
      env.VITE_STRIPE_TEST_PRODUCT_MONTHLY ||
      envConfig.stripeProducts?.monthly ||
      "prod_test_monthly",
    VITE_STRIPE_TEST_PRODUCT_YEARLY:
      env.VITE_STRIPE_TEST_PRODUCT_YEARLY ||
      envConfig.stripeProducts?.yearly ||
      "prod_test_yearly",
    VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER:
      env.VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER ||
      envConfig.stripeProducts?.earlyAdopter ||
      "prod_test_early_adopter",
    VITE_STRIPE_TEST_PRICE_MONTHLY:
      env.VITE_STRIPE_TEST_PRICE_MONTHLY ||
      envConfig.stripePrices?.monthly ||
      "price_test_monthly",
    VITE_STRIPE_TEST_PRICE_YEARLY:
      env.VITE_STRIPE_TEST_PRICE_YEARLY ||
      envConfig.stripePrices?.yearly ||
      "price_test_yearly",
    VITE_STRIPE_TEST_PRICE_EARLY_ADOPTER:
      env.VITE_STRIPE_TEST_PRICE_EARLY_ADOPTER ||
      envConfig.stripePrices?.earlyAdopter ||
      "price_test_early_adopter",
    VITE_STRIPE_LIVE_PRODUCT_MONTHLY:
      env.VITE_STRIPE_LIVE_PRODUCT_MONTHLY ||
      envConfig.stripeProducts?.monthly ||
      "prod_live_monthly",
    VITE_STRIPE_LIVE_PRODUCT_YEARLY:
      env.VITE_STRIPE_LIVE_PRODUCT_YEARLY ||
      envConfig.stripeProducts?.yearly ||
      "prod_live_yearly",
    VITE_STRIPE_LIVE_PRODUCT_EARLY_ADOPTER:
      env.VITE_STRIPE_LIVE_PRODUCT_EARLY_ADOPTER ||
      envConfig.stripeProducts?.earlyAdopter ||
      "prod_live_early_adopter",
    VITE_STRIPE_LIVE_PRICE_MONTHLY:
      env.VITE_STRIPE_LIVE_PRICE_MONTHLY ||
      envConfig.stripePrices?.monthly ||
      "price_live_monthly",
    VITE_STRIPE_LIVE_PRICE_YEARLY:
      env.VITE_STRIPE_LIVE_PRICE_YEARLY ||
      envConfig.stripePrices?.yearly ||
      "price_live_yearly",
    VITE_STRIPE_LIVE_PRICE_EARLY_ADOPTER:
      env.VITE_STRIPE_LIVE_PRICE_EARLY_ADOPTER ||
      envConfig.stripePrices?.earlyAdopter ||
      "price_live_early_adopter",
    VITE_APP_ENV: resolvedViteAppEnv || envConfig.name.toLowerCase(),
    VITE_DOMAIN: env.VITE_DOMAIN || envConfig.domain,
    VITE_HOST_EXPERIENCE: env.VITE_HOST_EXPERIENCE || "",
    VITE_CORS_ORIGINS:
      env.VITE_CORS_ORIGINS || JSON.stringify(envConfig.corsOrigins),
    VITE_AUTH_REDIRECT_URL: authRedirectUrl,
    VITE_KEEP_CONSOLE: env.VITE_KEEP_CONSOLE || process.env.VITE_KEEP_CONSOLE || "",
    VITE_DEBUG_API_BASE: env.VITE_DEBUG_API_BASE || process.env.VITE_DEBUG_API_BASE || "",
  };

  return {
    plugins: [agentDebugLogPlugin(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    // Environment variable configuration
    define: Object.fromEntries(
      Object.entries(viteEnvVars).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor chunks for better caching
            vendor: ["react", "react-dom", "react-router-dom"],
            audio: [
              "wavesurfer.js",
              "@wavesurfer/react",
              "web-audio-beat-detector",
            ],
            ui: [
              "lucide-react",
              "@tailwindcss/forms",
              "@tailwindcss/typography",
            ],
            auth: ["@supabase/supabase-js"],
            payments: ["@stripe/react-stripe-js", "@stripe/stripe-js"],
          },
          // Optimize chunk size
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
        },
      },
      // Optimize build performance
      target: "esnext",
      minify: "terser",
      terserOptions: {
        compress: {
          // Default: strip console in production. Set VITE_KEEP_CONSOLE or VITE_DEBUG_API_BASE=true in CI/Pages to retain logs.
          drop_console: !preserveConsoleInBuild,
          drop_debugger: !preserveConsoleInBuild,
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
    },
    // Dev-only TLS: optional so `vite build` (CI) loads config without certs present.
    ...(function devServerConfig() {
      const devKey = path.join(process.cwd(), "certs", "dev-key.pem");
      const devCert = path.join(process.cwd(), "certs", "dev-cert.pem");
      const https =
        fs.existsSync(devKey) && fs.existsSync(devCert)
          ? {
              key: fs.readFileSync(devKey),
              cert: fs.readFileSync(devCert),
            }
          : undefined;

      // Phone / LAN: set VITE_DEV_HMR_HOST to the host the device uses (e.g. 192.168.1.66)
      // so the HMR client does not fall back to wss://localhost (fails on mobile).
      const devHmrHost = env.VITE_DEV_HMR_HOST?.trim() || "";

      return {
        server: {
          host: "0.0.0.0",
          ...(https ? { https } : {}),
          hmr: devHmrHost
            ? {
                overlay: false,
                host: devHmrHost,
                protocol: https ? "wss" : "ws",
              }
            : { overlay: false },
          // Proxy for local development API
          proxy: {
            "/api/staging": {
              // target: "https://audafact-api-staging.david-g-cortinas.workers.dev",
              target: "http://localhost:8787", // Use proxy for local dev
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/staging/, "/api"),
              configure: (proxy, options) => {
                proxy.on("proxyReq", (proxyReq, req, res) => {
                  // Forward caller origin so backend CORS checks match the real browser origin.
                  const requestOrigin = req.headers.origin;
                  if (requestOrigin) {
                    proxyReq.setHeader("Origin", requestOrigin);
                  }
                });
                proxy.on("proxyRes", (proxyRes, req, res) => {
                  // Echo caller origin to support localhost and app.localhost dev hosts.
                  const requestOrigin = req.headers.origin;
                  if (requestOrigin) {
                    proxyRes.headers["Access-Control-Allow-Origin"] =
                      requestOrigin;
                  }
                  proxyRes.headers["Access-Control-Allow-Methods"] =
                    "GET,POST,OPTIONS";
                  proxyRes.headers["Access-Control-Allow-Headers"] =
                    "authorization,content-type,range";
                  proxyRes.headers["Access-Control-Expose-Headers"] =
                    "etag,content-range,accept-ranges,x-ratelimit-limit,x-ratelimit-remaining,x-ratelimit-reset";
                  proxyRes.headers["Vary"] = "Origin";
                });
              },
            },
          },
        },
      };
    })(),
    // Optimize dependencies
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "lucide-react"],
      exclude: [
        "wavesurfer.js",
        "@wavesurfer/react",
        "web-audio-beat-detector",
      ],
    },
  };
});
