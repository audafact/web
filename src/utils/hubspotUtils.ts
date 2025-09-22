/**
 * Utility functions for HubSpot integration
 */

import { isConsentAllowed } from "./consentUtils";

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
 * Gets the HubSpot tracking cookie (hutk) if it exists and consent is given
 * @returns The hutk cookie value or null if not found or consent not given
 */
export const getHubSpotCookie = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  // Check if analytics consent is given
  if (!isConsentAllowed("analytics")) {
    return null;
  }

  // Look for the hubspotutk cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "hubspotutk") {
      return value;
    }
  }

  return null;
};

/**
 * Gets the current timestamp in milliseconds since epoch
 * @returns Current timestamp in milliseconds
 */
export const getCurrentTimestamp = (): number => {
  return Date.now();
};

/**
 * Gets a cookie value by name
 * @param name - The cookie name
 * @returns The cookie value or null if not found
 */
const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
};

/**
 * Extracts UTM parameters from URL and cookies (GTM stored)
 * Prioritizes URL parameters over cookies (first-touch attribution)
 * @returns Object containing UTM parameters
 */
export const getUTMParameters = (): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
} => {
  if (typeof window === "undefined") {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);

  // UTM parameter keys
  const utmKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];

  const utmParams: Record<string, string | undefined> = {};

  utmKeys.forEach((key) => {
    // First try URL parameters (first-touch)
    const urlValue = urlParams.get(key);
    if (urlValue) {
      utmParams[key] = urlValue;
      return;
    }

    // Fallback to cookies (last-touch from GTM)
    const cookieValue = getCookie(key);
    if (cookieValue) {
      utmParams[key] = cookieValue;
    }
  });

  return {
    utm_source: utmParams.utm_source,
    utm_medium: utmParams.utm_medium,
    utm_campaign: utmParams.utm_campaign,
    utm_content: utmParams.utm_content,
    utm_term: utmParams.utm_term,
  };
};

/**
 * Check if HubSpot tracking is enabled based on consent
 * @returns true if analytics consent is given
 */
export const isHubSpotTrackingEnabled = (): boolean => {
  return isConsentAllowed("analytics");
};

/**
 * Initialize HubSpot tracking with consent
 * Call this after consent is given
 */
export const initializeHubSpotTracking = (): void => {
  if (typeof window === "undefined") return;

  if (isHubSpotTrackingEnabled()) {
    // HubSpot script should already be loaded
    if (window._hsq) {
      console.log("HubSpot tracking initialized with consent");
    }
  }
};
