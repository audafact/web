import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { getEnvironmentConfig } from "./config/environments.js";

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), "");

  // Get environment configuration
  const envConfig = getEnvironmentConfig();

  // Generate environment variables for Vite
  const viteEnvVars = {
    VITE_API_BASE_URL: env.VITE_API_BASE_URL || envConfig.apiUrl,
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
    VITE_APP_ENV: env.VITE_APP_ENV || envConfig.name.toLowerCase(),
    VITE_DOMAIN: env.VITE_DOMAIN || envConfig.domain,
    VITE_CORS_ORIGINS:
      env.VITE_CORS_ORIGINS || JSON.stringify(envConfig.corsOrigins),
  };

  return {
    plugins: [react()],
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
      ])
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
          drop_console: true,
          drop_debugger: true,
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
    },
    // Optimize dev server
    server: {
      hmr: {
        overlay: false,
      },
      // Proxy for staging API to bypass CORS
      proxy: {
        "/api/staging": {
          target: "https://audafact-api-staging.david-g-cortinas.workers.dev",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/staging/, "/api"),
          configure: (proxy, options) => {
            proxy.on("proxyReq", (proxyReq, req, res) => {
              // Add CORS headers to the proxy request
              proxyReq.setHeader("Origin", "http://localhost:5173");
            });
            proxy.on("proxyRes", (proxyRes, req, res) => {
              // Add CORS headers to the response
              proxyRes.headers["Access-Control-Allow-Origin"] =
                "http://localhost:5173";
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
