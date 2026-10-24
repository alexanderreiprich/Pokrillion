/**
 * HTTP Basic auth for the curation view. Any user name, password = ADMIN_PASSWORD.
 * Pure (no Node/Edge APIs) so it runs in the proxy and in server code alike.
 */
export const ADMIN_REALM = 'Basic realm="Pokrillion Admin", charset="UTF-8"';

/** Compares in time independent of where the strings differ. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** False when no admin password is configured – the curation view is then disabled. */
export function isAdminAuthorized(authorization: string | null, password: string | undefined): boolean {
  if (!password || !authorization?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(authorization.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  return separator >= 0 && safeEqual(decoded.slice(separator + 1), password);
}

export const ADMIN_PATH = /^\/(de|en)\/admin(\/|$)/;
