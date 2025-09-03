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
        (process.env.NODE_ENV === "development"
          ? "http://localhost:8787"
          : "https://api.audafact.com")
    ),
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["@/services/supabase"],
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
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "lucide-react"],
    exclude: ["wavesurfer.js", "@wavesurfer/react", "web-audio-beat-detector"],
  },
});
