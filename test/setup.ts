import "@testing-library/jest-dom";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Global Supabase mock to avoid conflicts between test files

// Configure React Testing Library for React 18 compatibility
import { configure } from "@testing-library/react";
configure({
  // Use longer timeout for async operations
  asyncUtilTimeout: 10000,
  testIdAttribute: "data-testid",
});

// Force React to use legacy rendering mode in tests
if (typeof global !== "undefined") {
  // @ts-ignore
  global.IS_REACT_ACT_ENVIRONMENT = false;
  // @ts-ignore
  global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: true,
  };
}

// Fix for jsdom and React 18 compatibility
if (typeof window !== "undefined") {
  // Mock HTMLElement if it doesn't exist
  if (!window.HTMLElement) {
    // @ts-ignore
    window.HTMLElement = class HTMLElement extends window.Element {};
  }

  // Mock document.activeElement to prevent instanceof errors
  Object.defineProperty(document, "activeElement", {
    get: () => null,
    configurable: true,
  });

  // Mock Element constructor to prevent instanceof errors
  if (!window.Element) {
    // @ts-ignore
    window.Element = class Element {};
  }

  // Mock Node constructor
  if (!window.Node) {
    // @ts-ignore
    window.Node = class Node {};
  }

  // Override the instanceof check for HTMLElement
  const originalInstanceof = Symbol.hasInstance;
  if (HTMLElement && !HTMLElement[originalInstanceof]) {
    // @ts-ignore
    HTMLElement[originalInstanceof] = function (obj: any) {
      return obj && typeof obj === "object" && obj.nodeType === 1;
    };
  }
}

// Add custom matchers to the global expect
declare global {
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void;
    }
  }
}

// Create a robust fetch mock that can't be easily overridden
const mockFetch = vi
  .fn()
  .mockImplementation((url: string, options?: RequestInit) => {
    // Default mock response - return a real Response object
    return Promise.resolve(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: "OK",
      })
    );
  });

// Mock the global fetch function using Object.defineProperty for better call tracking
Object.defineProperty(global, "fetch", {
  value: mockFetch,
  writable: true,
  configurable: true,
});

// Also set it on globalThis for compatibility
Object.defineProperty(globalThis, "fetch", {
  value: mockFetch,
  writable: true,
  configurable: true,
});

// Export the mock for use in tests
export { mockFetch };

// Mock Supabase using a dedicated mock file for better isolation
vi.mock("../src/services/supabase", () => import("./__mocks__/supabase"));

// Mock environment variables with valid values
vi.mock("../src/config", () => ({
  supabaseUrl: "https://mock-project.supabase.co",
  supabaseAnonKey: "mock-anon-key",
}));

// Mock API config with buildApiUrl function
vi.mock("../src/config/api", () => ({
  API_CONFIG: {
    BASE_URL: "https://audafact-api.david-g-cortinas.workers.dev",
    ENDPOINTS: {
      SIGN_UPLOAD: "/api/sign-upload",
      ANALYTICS: "/api/analytics",
    },
  },
  buildApiUrl: vi.fn(
    (endpoint: string) =>
      `https://audafact-api.david-g-cortinas.workers.dev${endpoint}`
  ),
}));

// Mock performance API
Object.defineProperty(global, "performance", {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
  },
  writable: true,
});

// Mock navigator
Object.defineProperty(global, "navigator", {
  value: {
    onLine: true,
    userAgent: "test-user-agent",
  },
  writable: true,
});

// Mock localStorage with actual storage simulation
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
Object.defineProperty(global, "sessionStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock window events and location with proper event handling
const eventListeners: Record<string, Array<(event?: any) => void>> = {};

const mockAddEventListener = vi.fn(
  (event: string, handler: (event?: any) => void) => {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event].push(handler);
  }
);

const mockRemoveEventListener = vi.fn(
  (event: string, handler: (event?: any) => void) => {
    if (eventListeners[event]) {
      const index = eventListeners[event].indexOf(handler);
      if (index > -1) {
        eventListeners[event].splice(index, 1);
      }
    }
  }
);

const mockDispatchEvent = vi.fn((event: Event) => {
  const handlers = eventListeners[event.type];
  if (handlers) {
    handlers.forEach((handler) => handler(event));
  }
});

Object.defineProperty(global, "window", {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    dispatchEvent: mockDispatchEvent,
    location: {
      href: "https://test.example.com",
      pathname: "/test",
      search: "",
      hash: "",
      host: "test.example.com",
      hostname: "test.example.com",
      port: "",
      protocol: "https:",
      origin: "https://test.example.com",
    },
  },
  writable: true,
});

// Also set on globalThis for compatibility
Object.defineProperty(globalThis, "window", {
  value: global.window,
  writable: true,
});
