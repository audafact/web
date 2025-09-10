import { defineConfig, devices } from "@playwright/experimental-ct-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: "./tests/playwright/components",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    // Component testing specific options
    ctPort: 3100,
    ctViteConfig: {
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "src"),
        },
      },
      define: {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
          "https://mock-project.supabase.co"
        ),
        "import.meta.env.VITE_SUPABASE_ANON_KEY":
          JSON.stringify("mock-anon-key"),
        "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
          "https://audafact-api.david-g-cortinas.workers.dev"
        ),
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
