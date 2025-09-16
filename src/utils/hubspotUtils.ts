/**
 * Utility functions for HubSpot integration
 */

/**
 * Gets the HubSpot tracking cookie (hutk) if it exists
 * @returns The hutk cookie value or null if not found
 */
export const getHubSpotCookie = (): string | null => {
  if (typeof document === "undefined") {
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
 * Extracts UTM parameters from the current URL
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

  return {
    utm_source: urlParams.get("utm_source") || undefined,
    utm_medium: urlParams.get("utm_medium") || undefined,
    utm_campaign: urlParams.get("utm_campaign") || undefined,
    utm_content: urlParams.get("utm_content") || undefined,
    utm_term: urlParams.get("utm_term") || undefined,
  };
};
