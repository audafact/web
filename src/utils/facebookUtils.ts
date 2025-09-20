/**
 * Facebook tracking utilities for Meta CAPI integration
 * Handles _fbp and _fbc cookie management for proper attribution
 */

/**
 * Get a cookie value by name
 * @param name - The cookie name
 * @returns string | null - The cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(";").shift();
    return cookieValue || null;
  }
  return null;
}

/**
 * Set a cookie with the given name, value, and options
 * @param name - The cookie name
 * @param value - The cookie value
 * @param days - Number of days until expiration (default: 90)
 * @param domain - Cookie domain (optional)
 */
export function setCookie(
  name: string,
  value: string,
  days: number = 90,
  domain?: string
): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  let cookieString = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

  if (domain) {
    cookieString += `; domain=${domain}`;
  }

  document.cookie = cookieString;
}

/**
 * Get Facebook Browser ID (_fbp cookie)
 * This cookie is automatically set by the Meta Pixel
 * @returns string | null - The _fbp value or null if not found
 */
export function getFacebookBrowserId(): string | null {
  return getCookie("_fbp");
}

/**
 * Get or create Facebook Click ID (_fbc cookie)
 * This is created from the fbclid URL parameter when users click Facebook ads
 * @returns string | null - The _fbc value or null if not available
 */
export function getFacebookClickId(): string | null {
  // First check if _fbc cookie already exists
  const existingFbc = getCookie("_fbc");
  if (existingFbc) {
    return existingFbc;
  }

  // If no _fbc cookie, try to create one from fbclid URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get("fbclid");

  if (fbclid) {
    // Create _fbc value: fb.{domain_id}.{timestamp}.{fbclid}
    // Domain ID is typically 1 for main domain
    const timestamp = Math.floor(Date.now() / 1000);
    const fbcValue = `fb.1.${timestamp}.${fbclid}`;

    // Set the _fbc cookie (90 days expiration)
    setCookie("_fbc", fbcValue, 90);

    return fbcValue;
  }

  return null;
}

/**
 * Get all Facebook tracking parameters for CAPI
 * @returns object with fbp and fbc values (if available)
 */
export function getFacebookTrackingParams(): { fbp?: string; fbc?: string } {
  const fbp = getFacebookBrowserId();
  const fbc = getFacebookClickId();

  const params: { fbp?: string; fbc?: string } = {};

  if (fbp) {
    params.fbp = fbp;
  }

  if (fbc) {
    params.fbc = fbc;
  }

  return params;
}

/**
 * Check if Facebook Pixel is loaded and available
 * @returns boolean - True if fbq function is available
 */
export function isPixelLoaded(): boolean {
  return (
    typeof window !== "undefined" && typeof (window as any).fbq === "function"
  );
}

/**
 * Wait for Facebook Pixel to load (with timeout)
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise<boolean> - Resolves to true if pixel loads, false if timeout
 */
export function waitForPixel(timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isPixelLoaded()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isPixelLoaded()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}
