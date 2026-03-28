export type HostExperience = "app" | "marketing";

const APP_EXPERIENCE = "app";
const MARKETING_EXPERIENCE = "marketing";

export const SAME_HOST_STUDIO_PATH = "/studio";

const normalizeHost = (rawHost: string): string => rawHost.trim().toLowerCase();

const withPort = (host: string, port?: string): string =>
  port ? `${host}:${port}` : host;

/** Literal IPv4 hostname (no port). */
const isIPv4Host = (host: string): boolean =>
  /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);

/**
 * Private / loopback / link-local IPv4 used for LAN dev (Vite over HTTPS to phone).
 * Avoids `app.${ip}` redirects, which are not real hosts.
 */
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

/**
 * Bonjour / mDNS names like `hostname.local` only resolve for that single label.
 * `app.hostname.local` usually does not exist, so same-host studio stays on this origin.
 */
const isBonjourLocalMarketingHost = (host: string): boolean =>
  host.endsWith(".local") && !host.startsWith("app.");

/**
 * True when the app is opened on a machine-local or typical LAN dev host.
 * Used so OAuth `redirectTo` and post-auth URLs stay on the current origin even when
 * `import.meta.env.DEV` is false (e.g. `vite preview`) or `VITE_AUTH_REDIRECT_URL` is a prod URL.
 */
export function isLocalBrowserDevHost(hostname: string): boolean {
  const h = normalizeHost(hostname);
  if (!h) return false;
  if (h === "localhost" || h === "127.0.0.1" || h === "app.localhost")
    return true;
  if (h === "::1" || h === "[::1]") return true;
  if (isIPv4Host(h) && isPrivateOrLoopbackIPv4(h)) return true;
  if (isBonjourLocalMarketingHost(h)) return true;
  return false;
}

const isAppHost = (host: string): boolean => {
  if (!host) return false;

  if (host === "app.audafact.com") return true;
  if (host === "app.localhost") return true;
  return host.startsWith("app.");
};

const isMarketingHost = (host: string): boolean => {
  if (!host) return false;

  return (
    host === "audafact.com" ||
    host === "www.audafact.com" ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
};

export const resolveHostExperience = (
  hostname?: string
): HostExperience => {
  const host =
    hostname !== undefined
      ? normalizeHost(hostname)
      : normalizeHost(window.location.hostname);

  if (isAppHost(host)) return APP_EXPERIENCE;
  if (isMarketingHost(host)) return MARKETING_EXPERIENCE;

  return MARKETING_EXPERIENCE;
};

export const getHostExperience = (): HostExperience => {
  const rawOverride = import.meta.env.VITE_HOST_EXPERIENCE?.toLowerCase();

  if (rawOverride === APP_EXPERIENCE || rawOverride === MARKETING_EXPERIENCE) {
    return rawOverride;
  }

  return resolveHostExperience();
};

const getAppHostname = (hostname: string): string => {
  const host = normalizeHost(hostname);

  if (host.startsWith("app.")) return host;
  if (host === "localhost" || host === "127.0.0.1") return "app.localhost";
  if (host === "audafact.com" || host === "www.audafact.com") {
    return "app.audafact.com";
  }
  if (host === "www.staging.audafact.com") {
    return "app.staging.audafact.com";
  }
  if (host.endsWith(".audafact.com")) return `app.${host}`;

  return `app.${host}`;
};

/** Absolute URL for the app experience root on the paired app host (same protocol/port). */
export const getAppEntryUrl = (
  hostname = window.location.hostname,
  protocol = window.location.protocol,
  port = window.location.port
): string => {
  const host = normalizeHost(hostname);

  // Cloudflare staging preview (*.pages.dev): no shared registrable domain with app.staging — stay same-host.
  if (host.endsWith(".audafact-web-staging.pages.dev")) {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}${SAME_HOST_STUDIO_PATH}`;
  }

  // Custom-domain staging (staging / www.staging *.audafact.com): same split as production → app.staging host.

  if (isIPv4Host(host) && isPrivateOrLoopbackIPv4(host)) {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}${SAME_HOST_STUDIO_PATH}`;
  }

  // `localhost` is not matched by the IPv4 helper above; many systems do not resolve
  // `app.localhost`, so keep studio entry on the same host as marketing in dev.
  if (host === "localhost") {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}${SAME_HOST_STUDIO_PATH}`;
  }

  if (isBonjourLocalMarketingHost(host)) {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}${SAME_HOST_STUDIO_PATH}`;
  }

  const targetHost = getAppHostname(hostname);
  const hostWithPort = withPort(targetHost, port);
  return `${protocol}//${hostWithPort}/`;
};

const appendSearch = (url: string, search: string | undefined): string => {
  if (!search?.trim()) return url;
  const s = search.trim();
  const q = s.startsWith("?") ? s.slice(1) : s;
  return url.includes("?") ? `${url}&${q}` : `${url}?${q}`;
};

/**
 * After OAuth / email confirmation, send the user to the canonical studio entry
 * for the current environment (marketing → same-host /studio or app origin /).
 */
export const getPostAuthStudioUrl = (search?: string): string => {
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const protocol =
    typeof window !== "undefined" ? window.location.protocol : "https:";
  const port = typeof window !== "undefined" ? window.location.port : "";

  const host = normalizeHost(hostname);
  const experience = getHostExperience();

  if (isLocalBrowserDevHost(host)) {
    const origin = `${protocol}//${withPort(host, port)}`;
    if (experience === "app") {
      return appendSearch(`${origin}/`, search);
    }
    return appendSearch(`${origin}${SAME_HOST_STUDIO_PATH}`, search);
  }

  return appendSearch(getAppEntryUrl(hostname, protocol, port), search);
};
