export type HostExperience = "app" | "marketing";

const APP_EXPERIENCE = "app";
const MARKETING_EXPERIENCE = "marketing";

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

  // Staging hosts can run as a single hostname (without app.<host> DNS).
  // Route /studio to same-host /stash in those environments.
  if (
    host === "staging.audafact.com" ||
    host.endsWith(".audafact-web-staging.pages.dev")
  ) {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}/stash`;
  }

  if (isIPv4Host(host) && isPrivateOrLoopbackIPv4(host)) {
    const hostWithPort = withPort(host, port);
    return `${protocol}//${hostWithPort}/stash`;
  }

  const targetHost = getAppHostname(hostname);
  const hostWithPort = withPort(targetHost, port);
  return `${protocol}//${hostWithPort}/`;
};
