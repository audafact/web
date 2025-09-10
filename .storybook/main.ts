import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Configure path aliases
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "../src"),
      // Mock hooks for Storybook
      "@/hooks/useUser": path.resolve(__dirname, "./mocks/useUser.ts"),
    };

    // Configure environment variables
    config.define = {
      ...config.define,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        "https://mock-project.supabase.co"
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        "https://audafact-api.david-g-cortinas.workers.dev"
      ),
    };

    // Fix for missing "./test" specifier in storybook package
    (config.resolve as any).fallback = {
      ...(config.resolve as any).fallback,
      "storybook/test": false,
    };

    // Additional Vite configuration to handle the build issue
    config.build = {
      ...config.build,
      rollupOptions: {
        ...config.build?.rollupOptions,
        external: (id) => {
          if (id.includes("storybook/test")) {
            return true;
          }
          return false;
        },
      },
    };

    return config;
  },
};
export default config;
