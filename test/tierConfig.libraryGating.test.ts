import { describe, expect, it } from "vitest";
import {
  LIBRARY_CATALOG_TOTAL_ACTIVE,
  LIBRARY_TIER_VISIBLE_CAPS,
  getLibraryVisibleCapForAppTier,
  getLibraryCatalogBannerText,
} from "../src/config/tierConfig";

describe("library catalog tier gating", () => {
  it("exposes PRD caps aligned with get_user_tracks migration", () => {
    expect(LIBRARY_TIER_VISIBLE_CAPS.guest).toBe(4);
    expect(LIBRARY_TIER_VISIBLE_CAPS.free).toBe(15);
    expect(LIBRARY_TIER_VISIBLE_CAPS.starter).toBe(35);
    expect(LIBRARY_TIER_VISIBLE_CAPS.pro).toBe(LIBRARY_CATALOG_TOTAL_ACTIVE);
  });

  it("getLibraryVisibleCapForAppTier maps tiers", () => {
    expect(getLibraryVisibleCapForAppTier("guest")).toBe(4);
    expect(getLibraryVisibleCapForAppTier("free")).toBe(15);
    expect(getLibraryVisibleCapForAppTier("starter")).toBe(35);
    expect(getLibraryVisibleCapForAppTier("pro")).toBe(
      LIBRARY_CATALOG_TOTAL_ACTIVE
    );
    expect(getLibraryVisibleCapForAppTier("unknown")).toBe(15);
  });

  it("getLibraryCatalogBannerText mentions counts for free tier", () => {
    const msg = getLibraryCatalogBannerText({
      tierId: "free",
      tierName: "Free",
      visibleCount: 15,
    });
    expect(msg).toContain("15");
    expect(msg).toContain(`${LIBRARY_CATALOG_TOTAL_ACTIVE}`);
    expect(msg.toLowerCase()).toContain("upgrade");
  });

  it("getLibraryCatalogBannerText is positive for pro", () => {
    const msg = getLibraryCatalogBannerText({
      tierId: "pro",
      tierName: "Pro",
      visibleCount: 59,
    });
    expect(msg.toLowerCase()).toContain("full catalog");
  });
});
