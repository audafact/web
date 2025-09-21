/**
 * SHA-256 hashing utility for Meta CAPI email hashing
 * Uses Web Crypto API for secure client-side hashing
 */

/**
 * Convert a string to SHA-256 hex hash
 * @param text - The text to hash
 * @returns Promise<string> - The SHA-256 hash in hex format
 */
export async function sha256Hex(text: string): Promise<string> {
  // Encode the text as UTF-8
  const msgBuffer = new TextEncoder().encode(text);

  // Hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Prepare email for Meta CAPI hashing (normalize then hash)
 * @param email - The email address to prepare
 * @returns Promise<string> - The normalized and hashed email
 */
export async function hashEmailForMeta(email: string): Promise<string> {
  // Normalize email: trim whitespace and convert to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  // Hash the normalized email
  return await sha256Hex(normalizedEmail);
}

/**
 * Generate a unique event ID for deduplication between Pixel and CAPI
 * @returns string - A unique event ID
 */
export function generateEventId(): string {
  return crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
