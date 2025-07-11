import "@testing-library/jest-dom";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Add custom matchers to the global expect
declare global {
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void;
    }
  }
}

// Mock Supabase with a valid URL
vi.mock("../src/services/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  },
}));

// Mock environment variables with valid values
vi.mock("../src/config", () => ({
  supabaseUrl: "https://mock-project.supabase.co",
  supabaseAnonKey: "mock-anon-key",
}));
