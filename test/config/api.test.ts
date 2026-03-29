import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isStagingBrowserHost,
  shouldUseStagingApiBase,
} from "../../src/config/api";

describe("api base staging detection", () => {
  const originalHostname = window.location.hostname;
  const originalAppEnv = import.meta.env.VITE_APP_ENV;

  beforeEach(() => {
    (import.meta.env as any).VITE_APP_ENV = originalAppEnv;
  });

  afterEach(() => {
    (window.location as any).hostname = originalHostname;
    (import.meta.env as any).VITE_APP_ENV = originalAppEnv;
  });

  it("treats apex audafact-web-staging.pages.dev as staging (not only *.audafact-web-staging.pages.dev)", () => {
    (window.location as any).hostname = "audafact-web-staging.pages.dev";
    expect(isStagingBrowserHost()).toBe(true);
  });

  it("still treats branch staging Pages hosts as staging", () => {
    (window.location as any).hostname = "develop.audafact-web-staging.pages.dev";
    expect(isStagingBrowserHost()).toBe(true);
  });

  it("shouldUseStagingApiBase is true when VITE_APP_ENV=staging even if hostname is not a staging host", () => {
    (window.location as any).hostname = "example.com";
    (import.meta.env as any).VITE_APP_ENV = "staging";
    expect(shouldUseStagingApiBase()).toBe(true);
  });

  it("shouldUseStagingApiBase follows hostname when app env is not staging", () => {
    (import.meta.env as any).VITE_APP_ENV = "production";
    (window.location as any).hostname = "app.staging.audafact.com";
    expect(shouldUseStagingApiBase()).toBe(true);
  });
});
