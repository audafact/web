import { describe, expect, it } from "vitest";
import { getSupabaseCookieDomain } from "../../src/routing/supabaseCookieDomain";

describe("getSupabaseCookieDomain", () => {
  it("returns undefined for local and preview-style hosts", () => {
    expect(getSupabaseCookieDomain("localhost")).toBeUndefined();
    expect(getSupabaseCookieDomain("127.0.0.1")).toBeUndefined();
    expect(getSupabaseCookieDomain("branch.preview.audafact-web-prod.pages.dev")).toBeUndefined();
    expect(getSupabaseCookieDomain("192.168.1.157")).toBeUndefined();
    expect(getSupabaseCookieDomain("davids-macbook.local")).toBeUndefined();
  });

  it("returns .audafact.com for production hosts", () => {
    expect(getSupabaseCookieDomain("www.audafact.com")).toBe(".audafact.com");
    expect(getSupabaseCookieDomain("app.audafact.com")).toBe(".audafact.com");
    expect(getSupabaseCookieDomain("audafact.com")).toBe(".audafact.com");
  });

  it("returns .staging.audafact.com for staging zone", () => {
    expect(getSupabaseCookieDomain("staging.audafact.com")).toBe(
      ".staging.audafact.com",
    );
    expect(getSupabaseCookieDomain("www.staging.audafact.com")).toBe(
      ".staging.audafact.com",
    );
    expect(getSupabaseCookieDomain("app.staging.audafact.com")).toBe(
      ".staging.audafact.com",
    );
  });

  it("returns undefined for unrelated hosts", () => {
    expect(getSupabaseCookieDomain("example.com")).toBeUndefined();
    expect(getSupabaseCookieDomain("")).toBeUndefined();
  });
});
