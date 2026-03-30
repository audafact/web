/**
 * Cookie parent domain for Supabase auth on audafact.com so PKCE verifier and
 * session chunks are visible across www and app (and other subdomains).
 * Returns undefined when cookies must stay host-only (local dev, previews, LAN).
 */

const normalizeHost = (rawHost: string): string => rawHost.trim().toLowerCase();

/** Literal IPv4 hostname (no port). */
const isIPv4Host = (host: string): boolean =>
  /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);

const isPrivateOrLoopbackIPv4 = (host: string): boolean => {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isBonjourLocalMarketingHost = (host: string): boolean =>
  host.endsWith(".local") && !host.startsWith("app.");

export function getSupabaseCookieDomain(hostname: string): string | undefined {
  const host = normalizeHost(hostname);
  if (!host) return undefined;

  if (host === "localhost" || host === "127.0.0.1") return undefined;
  if (isBonjourLocalMarketingHost(host)) return undefined;
  if (isIPv4Host(host) && isPrivateOrLoopbackIPv4(host)) return undefined;
  if (host.endsWith(".pages.dev")) return undefined;

  if (
    host === "staging.audafact.com" ||
    host.endsWith(".staging.audafact.com")
  ) {
    return ".staging.audafact.com";
  }

  if (host === "audafact.com" || host.endsWith(".audafact.com")) {
    return ".audafact.com";
  }

  return undefined;
}
