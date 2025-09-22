/**
 * Debug utilities for testing cookie consent and HubSpot integration
 */

import {
  getConsentState,
  getConsentPreferences,
  isConsentAllowed,
  resetAllConsent,
} from "./consentUtils";
import { getHubSpotCookie, isHubSpotTrackingEnabled } from "./hubspotUtils";

// Declare HubSpot global types
declare global {
  interface Window {
    _hsq: {
      q: any[];
      push: (args: any[]) => void;
    };
  }
}

/**
 * Debug consent state and HubSpot integration
 * Call this in browser console to check everything
 */
export const debugConsent = () => {
  console.log("🍪 === COOKIE CONSENT DEBUG ===");

  // Check consent state
  const consentState = getConsentState();
  console.log("Consent State:", consentState);

  // Check preferences
  const preferences = getConsentPreferences();
  console.log("Consent Preferences:", preferences);

  // Check individual categories
  console.log("Analytics Allowed:", isConsentAllowed("analytics"));
  console.log("Marketing Allowed:", isConsentAllowed("marketing"));
  console.log("Preferences Allowed:", isConsentAllowed("preferences"));

  // Check HubSpot integration
  console.log("HubSpot Tracking Enabled:", isHubSpotTrackingEnabled());
  console.log("HubSpot Cookie:", getHubSpotCookie());

  // Check HubSpot script loading
  console.log(
    "HubSpot Script Loaded:",
    !!document.querySelector("#hs-script-loader")
  );
  console.log("HubSpot Global (_hsq):", typeof window._hsq !== "undefined");

  if (typeof window._hsq !== "undefined") {
    console.log("HubSpot Queue:", window._hsq.q);
  }

  // Check all cookies
  console.log("All Cookies:", document.cookie);

  // Check HubSpot-specific cookies
  const hubspotCookies = document.cookie
    .split(";")
    .filter((c) => c.includes("hubspot") || c.includes("_hs"));
  console.log("HubSpot Cookies:", hubspotCookies);

  console.log("🍪 === END DEBUG ===");
};

/**
 * Debug UTM parameter handling
 */
export const debugUTMParameters = () => {
  console.log("🔗 === UTM PARAMETERS DEBUG ===");

  // Check current URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const urlUTMs = {
    utm_source: urlParams.get("utm_source"),
    utm_medium: urlParams.get("utm_medium"),
    utm_campaign: urlParams.get("utm_campaign"),
    utm_content: urlParams.get("utm_content"),
    utm_term: urlParams.get("utm_term"),
  };
  console.log("URL UTM Parameters:", urlUTMs);

  // Check GTM stored cookies
  const utmKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];
  const cookieUTMs: Record<string, string | null> = {};
  utmKeys.forEach((key) => {
    const value = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith(`${key}=`))
      ?.split("=")[1];
    cookieUTMs[key] = value ? decodeURIComponent(value) : null;
  });
  console.log("Cookie UTM Parameters:", cookieUTMs);

  // Test the getUTMParameters function
  const { getUTMParameters } = require("./hubspotUtils");
  const finalUTMs = getUTMParameters();
  console.log("Final UTM Parameters (from getUTMParameters):", finalUTMs);

  console.log("🔗 === END UTM DEBUG ===");
};

/**
 * Test consent flow
 */
export const testConsentFlow = () => {
  console.log("🧪 Testing consent flow...");

  // Reset everything first
  resetAllConsent();
  console.log("Reset all consent");

  // Check initial state
  debugConsent();

  // Simulate accepting analytics
  console.log("Simulating analytics consent...");
  // This would normally be done through the UI
  console.log("Use the cookie banner to test the full flow");
};

/**
 * Check if HubSpot is working properly
 */
export const checkHubSpotIntegration = () => {
  console.log("🔍 Checking HubSpot integration...");

  // Check if script is loaded
  const script = document.querySelector("#hs-script-loader");
  if (!script) {
    console.error("❌ HubSpot script not found in DOM");
    return;
  }

  console.log("✅ HubSpot script found");

  // Check if _hsq is available
  if (typeof window._hsq === "undefined") {
    console.warn(
      "⚠️ HubSpot _hsq not available yet (script may still be loading)"
    );
    return;
  }

  console.log("✅ HubSpot _hsq available");
  console.log("Queue length:", window._hsq.q.length);

  // Check consent
  if (!isConsentAllowed("analytics")) {
    console.warn("⚠️ Analytics consent not given - HubSpot tracking disabled");
    return;
  }

  console.log("✅ Analytics consent given - HubSpot should be tracking");

  // Check for tracking cookie
  const hutk = getHubSpotCookie();
  if (hutk) {
    console.log("✅ HubSpot tracking cookie found:", hutk);
  } else {
    console.log(
      "ℹ️ No HubSpot tracking cookie yet (may appear after first page interaction)"
    );
  }
};

/**
 * Force enable all consent for testing
 */
export const forceEnableAllConsent = () => {
  console.log("🔧 Force enabling all consent for testing...");

  const allConsent = {
    necessary: true,
    analytics: true,
    marketing: true,
    preferences: true,
  };

  // This would normally go through the proper consent flow
  // For testing, we'll directly manipulate localStorage
  localStorage.setItem(
    "audafact_cookie_consent",
    JSON.stringify({
      hasConsented: true,
      preferences: allConsent,
      timestamp: Date.now(),
      version: "1.0.0",
    })
  );

  console.log("✅ All consent enabled");
  debugConsent();
};

/**
 * Clear all consent and cookies for testing
 */
export const clearAllForTesting = () => {
  console.log("🧹 Clearing all consent and cookies for testing...");

  resetAllConsent();

  // Clear all cookies
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  console.log("✅ All cleared");
  debugConsent();
};

// Make functions available globally for debugging
if (typeof window !== "undefined") {
  (window as any).debugConsent = debugConsent;
  (window as any).debugUTMParameters = debugUTMParameters;
  (window as any).testConsentFlow = testConsentFlow;
  (window as any).checkHubSpotIntegration = checkHubSpotIntegration;
  (window as any).forceEnableAllConsent = forceEnableAllConsent;
  (window as any).clearAllForTesting = clearAllForTesting;
}
