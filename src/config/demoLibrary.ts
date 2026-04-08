/** Supabase app_config.key and library_tracks.demo_collection_slug for the Cristian Sigler demo pack. */
export const CRISTIAN_SIGLER_DEMO_COLLECTION_KEY =
  "demo_collection.cristian_sigler_drum_pack_v1";

/** Submenu label in Tracks (exact copy for supplier demo). */
export const CRISTIAN_SIGLER_DEMO_SIDE_PANEL_LABEL =
  "Drum Pack on Tape Volume 1 - Cristian Sigler";

export const DEMO_LIBRARY_ACCOUNT_EMAIL = "demo@audafact.com";

export function isDemoLibraryAccount(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === DEMO_LIBRARY_ACCOUNT_EMAIL;
}
