import type { User } from "@supabase/supabase-js";

/** True if the user can sign in with email + password (has an email identity). */
export function userHasEmailPasswordIdentity(user: User): boolean {
  return user.identities?.some((i) => i.provider === "email") ?? false;
}
