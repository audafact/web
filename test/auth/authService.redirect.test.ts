import { describe, expect, it, afterEach } from "vitest";
import { getAuthRedirectUrl } from "../../src/auth/authService";

describe("getAuthRedirectUrl", () => {
  const originalDev = import.meta.env.DEV;
  const originalAuthRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL;
  const originalAppEnv = import.meta.env.VITE_APP_ENV;
  const loc = window.location;

  afterEach(() => {
    (import.meta.env as unknown as { DEV: boolean }).DEV = originalDev;
    (import.meta.env as unknown as { VITE_AUTH_REDIRECT_URL?: string }).VITE_AUTH_REDIRECT_URL =
      originalAuthRedirect;
    (import.meta.env as unknown as { VITE_APP_ENV: string }).VITE_APP_ENV =
      originalAppEnv;
    Object.defineProperty(window, "location", {
      value: loc,
      writable: true,
      configurable: true,
    });
  });

  it("uses current origin on localhost even when DEV is false and VITE_AUTH_REDIRECT_URL is production", () => {
    (import.meta.env as unknown as { DEV: boolean }).DEV = false;
    (
      import.meta.env as unknown as { VITE_AUTH_REDIRECT_URL: string }
    ).VITE_AUTH_REDIRECT_URL = "https://app.audafact.com/auth/callback";
    (import.meta.env as unknown as { VITE_APP_ENV: string }).VITE_APP_ENV =
      "production";

    const mockLoc = {
      ...loc,
      hostname: "localhost",
      origin: "http://localhost:5173",
      protocol: "http:",
      port: "5173",
    };
    Object.defineProperty(window, "location", {
      value: mockLoc,
      writable: true,
      configurable: true,
    });

    expect(getAuthRedirectUrl()).toBe("http://localhost:5173/auth/callback");
  });

  it("uses current origin when VITE_APP_ENV is development even if DEV is false and host is not loopback/LAN", () => {
    (import.meta.env as unknown as { DEV: boolean }).DEV = false;
    (
      import.meta.env as unknown as { VITE_AUTH_REDIRECT_URL: string }
    ).VITE_AUTH_REDIRECT_URL = "https://app.audafact.com/auth/callback";
    (import.meta.env as unknown as { VITE_APP_ENV: string }).VITE_APP_ENV =
      "development";

    const mockLoc = {
      ...loc,
      hostname: "dev.audafact.test",
      origin: "http://dev.audafact.test:5173",
      protocol: "http:",
      port: "5173",
    };
    Object.defineProperty(window, "location", {
      value: mockLoc,
      writable: true,
      configurable: true,
    });

    expect(getAuthRedirectUrl()).toBe(
      "http://dev.audafact.test:5173/auth/callback",
    );
  });

  it("does not use localhost VITE_AUTH_REDIRECT_URL on Bonjour .local (phone / LAN dev host)", () => {
    (import.meta.env as unknown as { DEV: boolean }).DEV = true;
    (
      import.meta.env as unknown as { VITE_AUTH_REDIRECT_URL: string }
    ).VITE_AUTH_REDIRECT_URL = "https://localhost:5173/auth/callback";
    (import.meta.env as unknown as { VITE_APP_ENV: string }).VITE_APP_ENV =
      "development";

    const mockLoc = {
      ...loc,
      hostname: "davids-macbook-pro-2.local",
      origin: "https://davids-macbook-pro-2.local:5173",
      protocol: "https:",
      port: "5173",
    };
    Object.defineProperty(window, "location", {
      value: mockLoc,
      writable: true,
      configurable: true,
    });

    expect(getAuthRedirectUrl()).toBe(
      "https://davids-macbook-pro-2.local:5173/auth/callback",
    );
  });
});
