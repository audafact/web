/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    deps: {
      inline: [/@supabase/],
    },
    environmentOptions: {
      jsdom: {
        resources: "usable",
        pretendToBeVisual: true,
      },
    },
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      "https://mock-project.supabase.co"
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
  },
});
