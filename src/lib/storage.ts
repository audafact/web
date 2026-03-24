import { signFile, API_BASE, authHeader } from "@/lib/api";

/** Get a short-lived signed GET URL for playback/download (uses shared cache) */
export async function getSignedUrl(key: string): Promise<string> {
  const url = await signFile(key);
  if (!url) throw new Error("No URL returned");
  return url;
}

/** Delete an object by key (requires a matching Worker route) */
export async function deleteByKey(key: string): Promise<{ ok: true }> {
  const headers = {
    ...(await authHeader()),
    "content-type": "application/json",
  };
  const r = await fetch(`${API_BASE}/delete-file`, {
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
