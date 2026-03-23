export type HostExperience = "app" | "marketing";

const APP_EXPERIENCE = "app";
const MARKETING_EXPERIENCE = "marketing";

const normalizeHost = (rawHost: string): string => rawHost.trim().toLowerCase();

const withPort = (host: string, port?: string): string =>
  port ? `${host}:${port}` : host;

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
  const targetHost = getAppHostname(hostname);
  const hostWithPort = withPort(targetHost, port);
  return `${protocol}//${hostWithPort}/`;
};
