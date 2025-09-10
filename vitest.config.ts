/// <reference types="vitest" />
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
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "**/tests/playwright/**", // Exclude Playwright tests
    ],
    deps: {
      inline: [/@supabase/],
    },
    // Configure for React 18 compatibility
    pool: "threads",
    isolate: false,
    // Add test timeout and retry configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    // Disable concurrent test execution to avoid race conditions
    maxConcurrency: 1,
    // Add sequence configuration to run tests one by one
    sequence: {
      concurrent: false,
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      "https://mock-project.supabase.co"
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
      "https://audafact-api.david-g-cortinas.workers.dev"
    ),
  },
});
