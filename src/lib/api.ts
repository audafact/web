// web/src/lib/api.ts
import { supabase } from "@/services/supabase";

const API_BASE = "https://audafact-api.david-g-cortinas.workers.dev"; // Hardcoded for testing

export async function signFile(key: string): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const r = await fetch(
    `${API_BASE}/api/sign-file?key=${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!r.ok) throw new Error(`sign-file failed: ${r.status}`);
  const { url } = await r.json();
  return url as string;
}
