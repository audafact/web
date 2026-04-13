import { supabase } from './supabase';

export type UserProfileRow = {
  access_tier: string | null;
  subscription_id: string | null;
  plan_interval: string | null;
  pro_access_source: string | null;
  pro_expires_at: string | null;
};

type ProfileResult = {
  data: UserProfileRow | null;
  error: { message: string } | null;
};

/** In-flight dedupe: concurrent callers (e.g. useUser + useUserAccess on Studio) share one request. */
const inflight = new Map<string, Promise<ProfileResult>>();

/**
 * Single row read for Studio hooks. Replaces duplicate `select(access_tier)` + wider selects.
 */
export function fetchUserProfileRow(userId: string): Promise<ProfileResult> {
  const existing = inflight.get(userId);
  if (existing) return existing;

  const p = supabase
    .from('users')
    .select('access_tier, subscription_id, plan_interval, pro_access_source, pro_expires_at')
    .eq('id', userId)
    .single()
    .then(({ data, error }) => ({
      data: data as UserProfileRow | null,
      error: error ? { message: error.message } : null,
    }))
    .finally(() => {
      inflight.delete(userId);
    });

  inflight.set(userId, p);
  return p;
}
