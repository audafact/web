import { supabase } from "@/services/supabase";

const API_BASE = "https://audafact-api.david-g-cortinas.workers.dev"; // Production Worker for now

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}` };
}

/** Get a short-lived signed GET URL for playback/download */
export async function getSignedUrl(key: string): Promise<string> {
  const headers = await authHeader();
  const r = await fetch(
    `${API_BASE}/api/sign-file?key=${encodeURIComponent(key)}`,
    { headers }
  );
  if (!r.ok) throw new Error(`sign-file failed: ${r.status}`);
  const { url } = await r.json();
  if (!url) throw new Error("No URL returned");
  return url;
}

/** Delete an object by key (requires a matching Worker route) */
export async function deleteByKey(key: string): Promise<{ ok: true }> {
  const headers = {
    ...(await authHeader()),
    "content-type": "application/json",
  };
  const r = await fetch(`${API_BASE}/api/delete-file`, {
    method: "POST",
    headers,
    body: JSON.stringify({ key }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`delete-file failed: ${r.status} ${msg}`);
  }
  return { ok: true };
}
