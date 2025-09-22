/**
 * Cookie consent management utilities
 * Handles GDPR-compliant cookie consent and tracking script management
 */

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export interface ConsentState {
  hasConsented: boolean;
  preferences: ConsentPreferences;
  timestamp: number;
  version: string;
}

const CONSENT_STORAGE_KEY = "audafact_cookie_consent";
const CONSENT_VERSION = "1.0.0";

// Default consent preferences (only necessary cookies by default)
const DEFAULT_CONSENT: ConsentPreferences = {
  necessary: true, // Always true - required for site functionality
  analytics: false,
  marketing: false,
  preferences: false,
};

/**
 * Get current consent state from localStorage
 */
export const getConsentState = (): ConsentState | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Check if consent version is current
    if (parsed.version !== CONSENT_VERSION) {
      // Reset consent if version changed
      clearConsentState();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Error reading consent state:", error);
    return null;
  }
};

/**
 * Save consent state to localStorage
 */
export const saveConsentState = (preferences: ConsentPreferences): void => {
  if (typeof window === "undefined") return;

  const consentState: ConsentState = {
    hasConsented: true,
    preferences,
    timestamp: Date.now(),
    version: CONSENT_VERSION,
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentState));
  } catch (error) {
    console.error("Error saving consent state:", error);
  }
};

/**
 * Clear consent state from localStorage
 */
export const clearConsentState = (): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing consent state:", error);
  }
};

/**
 * Check if user has given consent
 */
export const hasConsented = (): boolean => {
  const state = getConsentState();
  return state?.hasConsented || false;
};

/**
 * Get current consent preferences
 */
export const getConsentPreferences = (): ConsentPreferences => {
  const state = getConsentState();
  return state?.preferences || DEFAULT_CONSENT;
};

/**
 * Check if specific consent category is allowed
 */
export const isConsentAllowed = (
  category: keyof ConsentPreferences
): boolean => {
  const preferences = getConsentPreferences();
  return preferences[category];
};

/**
 * Initialize consent management
 * Call this when the app loads
 */
export const initializeConsent = (): ConsentState | null => {
  const state = getConsentState();

  if (state) {
    // Apply consent preferences to tracking scripts
    applyConsentPreferences(state.preferences);
  }

  return state;
};

/**
 * Apply consent preferences to tracking scripts
 */
export const applyConsentPreferences = (
  preferences: ConsentPreferences
): void => {
  // HubSpot tracking
  if (preferences.analytics || preferences.marketing) {
    enableHubSpotTracking();
  } else {
    disableHubSpotTracking();
  }

  // Google Analytics (via GTM)
  if (preferences.analytics) {
    enableGoogleAnalytics();
  } else {
    disableGoogleAnalytics();
  }

  // Facebook Pixel (if you have it)
  if (preferences.marketing) {
    enableFacebookPixel();
  } else {
    disableFacebookPixel();
  }
};

/**
 * Enable HubSpot tracking
 */
const enableHubSpotTracking = (): void => {
  // HubSpot script should already be loaded, just ensure it's active
  if (typeof window !== "undefined" && window._hsq) {
    // HubSpot is already loaded and will start tracking
    console.log("HubSpot tracking enabled");
  }
};

/**
 * Disable HubSpot tracking
 */
const disableHubSpotTracking = (): void => {
  // Clear HubSpot cookies
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    cookies.forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name.includes("hubspot") || name.includes("_hs")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      }
    });
  }

  // Disable HubSpot tracking
  if (typeof window !== "undefined" && window._hsq) {
    window._hsq.push(["revokeConsent"]);
  }
};

/**
 * Enable Google Analytics
 */
const enableGoogleAnalytics = (): void => {
  // GTM is already loaded, just ensure it's active
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: "consent_update",
      analytics_consent: "granted",
    });
  }
};

/**
 * Disable Google Analytics
 */
const disableGoogleAnalytics = (): void => {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: "consent_update",
      analytics_consent: "denied",
    });
  }
};

/**
 * Enable Facebook Pixel
 */
const enableFacebookPixel = (): void => {
  // If you have Facebook Pixel, enable it here
  console.log("Facebook Pixel enabled");
};

/**
 * Disable Facebook Pixel
 */
const disableFacebookPixel = (): void => {
  // If you have Facebook Pixel, disable it here
  console.log("Facebook Pixel disabled");
};

/**
 * Reset all consent and clear all tracking
 */
export const resetAllConsent = (): void => {
  clearConsentState();

  // Clear all tracking cookies
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    cookies.forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (
        name.includes("_") ||
        name.includes("hubspot") ||
        name.includes("google") ||
        name.includes("fb")
      ) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      }
    });
  }

  // Reset all tracking scripts
  disableHubSpotTracking();
  disableGoogleAnalytics();
  disableFacebookPixel();
};
