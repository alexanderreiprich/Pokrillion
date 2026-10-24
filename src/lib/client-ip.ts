/**
 * The caller's IP from proxy headers. On Vercel `x-forwarded-for` is set by the platform
 * (client values are overwritten), its first entry is the client.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}
