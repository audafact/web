import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Environment variable configuration
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      process.env.VITE_API_BASE_URL ||
        "https://audafact-api.david-g-cortinas.workers.dev"
    ),
    "import.meta.env.VITE_TURNSTILE_SITE_KEY": JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABpJ3cypikhi7CPU"
    ),
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          vendor: ["react", "react-dom", "react-router-dom"],
          audio: [
            "wavesurfer.js",
            "@wavesurfer/react",
            "web-audio-beat-detector",
          ],
          ui: ["lucide-react", "@tailwindcss/forms", "@tailwindcss/typography"],
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
    exclude: ["wavesurfer.js", "@wavesurfer/react", "web-audio-beat-detector"],
  },
});
