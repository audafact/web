import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRoutes } from "../../src/routes";
import {
  getAppEntryUrl,
  getHostExperience,
  getPostAuthStudioUrl,
  isLocalBrowserDevHost,
  resolveHostExperience,
} from "../../src/routing/hostRouting";

describe("host routing classifier", () => {
  const originalOverride = import.meta.env.VITE_HOST_EXPERIENCE;
  const originalAppEnv = (import.meta.env as any).VITE_APP_ENV;
  const originalHostname = window.location.hostname;

  beforeEach(() => {
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "";
    (import.meta.env as any).VITE_APP_ENV = originalAppEnv;
    (window.location as any).hostname = "test.example.com";
  });

  afterEach(() => {
    (import.meta.env as any).VITE_HOST_EXPERIENCE = originalOverride;
    (import.meta.env as any).VITE_APP_ENV = originalAppEnv;
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

  it("isLocalBrowserDevHost matches typical local and LAN dev hostnames", () => {
    expect(isLocalBrowserDevHost("localhost")).toBe(true);
    expect(isLocalBrowserDevHost("127.0.0.1")).toBe(true);
    expect(isLocalBrowserDevHost("::1")).toBe(true);
    expect(isLocalBrowserDevHost("app.localhost")).toBe(true);
    expect(isLocalBrowserDevHost("192.168.1.10")).toBe(true);
    expect(isLocalBrowserDevHost("my-macbook.local")).toBe(true);
    expect(isLocalBrowserDevHost("www.audafact.com")).toBe(false);
    expect(isLocalBrowserDevHost("preview.audafact-web-staging.pages.dev")).toBe(
      false
    );
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
    expect(getAppEntryUrl("www.staging.audafact.com", "https:", "")).toBe(
      "https://app.staging.audafact.com/"
    );
  });

  it("uses same-host /studio for localhost marketing dev (app.localhost often not in DNS)", () => {
    expect(getAppEntryUrl("localhost", "http:", "5173")).toBe(
      "http://localhost:5173/studio"
    );
  });

  it("uses same-host /studio for staging Pages host", () => {
    expect(
      getAppEntryUrl(
        "develop.audafact-web-staging.pages.dev",
        "https:",
        ""
      )
    ).toBe("https://develop.audafact-web-staging.pages.dev/studio");
  });

  it("uses same-host /studio for LAN IPv4 dev (no app.192.168… redirect)", () => {
    expect(getAppEntryUrl("192.168.1.157", "https:", "5173")).toBe(
      "https://192.168.1.157:5173/studio"
    );
  });

  it("uses same-host /studio for Bonjour *.local marketing host (app.*.local not in DNS)", () => {
    expect(
      getAppEntryUrl("davids-macbook-pro-2.local", "https:", "5173")
    ).toBe("https://davids-macbook-pro-2.local:5173/studio");
  });
});

describe("getPostAuthStudioUrl", () => {
  const originalHostname = window.location.hostname;
  const originalProtocol = window.location.protocol;
  const originalPort = (window.location as { port?: string }).port ?? "";
  const originalOverride = import.meta.env.VITE_HOST_EXPERIENCE;

  afterEach(() => {
    (window.location as any).hostname = originalHostname;
    (window.location as any).protocol = originalProtocol;
    (window.location as any).port = originalPort;
    (import.meta.env as any).VITE_HOST_EXPERIENCE = originalOverride;
  });

  it("uses app entry and appends search for production marketing", () => {
    (window.location as any).hostname = "www.audafact.com";
    (window.location as any).protocol = "https:";
    (window.location as any).port = "";
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "";
    expect(getPostAuthStudioUrl("verified=1")).toBe(
      "https://app.audafact.com/?verified=1"
    );
  });

  it("uses localhost /studio in marketing post-auth (local browser host)", () => {
    (window.location as any).hostname = "localhost";
    (window.location as any).protocol = "http:";
    (window.location as any).port = "5173";
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "";
    expect(getPostAuthStudioUrl()).toBe("http://localhost:5173/studio");
  });

  it("uses localhost root in app experience override on local browser host", () => {
    (window.location as any).hostname = "localhost";
    (window.location as any).protocol = "http:";
    (window.location as any).port = "5173";
    (import.meta.env as any).VITE_HOST_EXPERIENCE = "app";
    expect(getPostAuthStudioUrl("tier=pro")).toBe(
      "http://localhost:5173/?tier=pro"
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
    expect(studioRoute.element.type.name).toBe("StudioEntryRoute");
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
