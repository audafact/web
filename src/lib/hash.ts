// apps/web/src/lib/hash.ts
export function toHex(buf: ArrayBuffer): string {
  const v = new Uint8Array(buf);
  const lut = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));
  let out = "";
  for (let i = 0; i < v.length; i++) out += lut[v[i]];
  return out;
}

export function shortHex(fullHex: string, len = 10) {
  return fullHex.slice(0, Math.max(4, Math.min(len, fullHex.length)));
}

export async function sha256Blob(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return toHex(digest);
}
