import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRoutes } from "../../src/routes";
import {
  getAppEntryUrl,
  getHostExperience,
  resolveHostExperience,
} from "../../src/routing/hostRouting";

describe("host routing classifier", () => {
  const originalOverride = import.meta.env.VITE_HOST_EXPERIENCE;
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "";
    (window.location as any).hostname = "test.example.com";
  });

  afterEach(() => {
    (import.meta.env as any).VITE_HOST_EXPERIENCE = originalOverride;
    (window.location as any).hostname = originalHostname;
  });

  it("classifies app hosts correctly", () => {
    expect(resolveHostExperience("app.audafact.com")).toBe("app");
    expect(resolveHostExperience("app.localhost")).toBe("app");
    expect(resolveHostExperience("app.staging.audafact.com")).toBe("app");
  });

  it("classifies marketing hosts correctly", () => {
    expect(resolveHostExperience("audafact.com")).toBe("marketing");
    expect(resolveHostExperience("www.audafact.com")).toBe("marketing");
    expect(resolveHostExperience("localhost")).toBe("marketing");
  });

  it("defaults unknown hosts to marketing", () => {
    expect(resolveHostExperience("foo.example.com")).toBe("marketing");
  });

  it("supports explicit host experience override", () => {
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "app";
    expect(getHostExperience()).toBe("app");

    (import.meta.env as any).VITE_HOST_EXPERIENCE = "marketing";
    expect(getHostExperience()).toBe("marketing");
  });

  it("builds app entry URL for marketing and staging hosts", () => {
    expect(getAppEntryUrl("audafact.com", "https:", "")).toBe(
      "https://app.audafact.com/"
    );
    expect(getAppEntryUrl("staging.audafact.com", "https:", "")).toBe(
      "https://app.staging.audafact.com/"
    );
  });
});

describe("router host-aware/canonical routes", () => {
  const rootRoute = appRoutes.find((route: any) => route.path === "/") as any;
  const childRoutes = rootRoute.children as any[];

  it("keeps root route index resolver in place", () => {
    const indexRoute = childRoutes.find((route) => route.index === true);
    expect(indexRoute).toBeDefined();
    expect(indexRoute.element).toBeDefined();
  });

  it("redirects /studio to canonical root", () => {
    const studioRoute = childRoutes.find((route) => route.path === "studio");
    expect(studioRoute).toBeDefined();
    expect(studioRoute.element.type.name).toBe("LegacyStudioRedirect");
  });

  it("uses /account as canonical and redirects /profile", () => {
    const accountRoute = childRoutes.find((route) => route.path === "account");
    const profileRoute = childRoutes.find((route) => route.path === "profile");

    expect(accountRoute).toBeDefined();
    expect(profileRoute).toBeDefined();
    expect(profileRoute.element.type.name).toBe("Navigate");
    expect(profileRoute.element.props.to).toBe("/account");
    expect(profileRoute.element.props.replace).toBe(true);
  });
});
