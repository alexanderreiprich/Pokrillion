import "server-only";
import { createHmac } from "node:crypto";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db/server";
import { ApiError } from "./http";

/** Guesses per window. Generous per IP so friends on the same Wi-Fi don't block each other. */
export const GUESS_LIMIT = {
  windowS: 60,
  perPlayer: 30,
  perIp: 120,
} as const;

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** IPs are stored only as a keyed hash; rotating the secret just resets the counters. */
function ipKey(ip: string): string {
  const secret = process.env.CRON_SECRET ?? "local";
  return `ip:${createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)}`;
}

/** Counts one guess for the player and their IP; throws `rate_limited` if either is over. */
export async function limitGuesses(headers: Headers, playerId: string): Promise<void> {
  const keys = [`pid:${playerId}`];
  const max: number[] = [GUESS_LIMIT.perPlayer];
  const ip = clientIp(headers);
  if (ip) {
    keys.push(ipKey(ip));
    max.push(GUESS_LIMIT.perIp);
  }
  const ok = check(
    await db().rpc("hit_rate_limits", { p_keys: keys, p_max: max, p_window_s: GUESS_LIMIT.windowS }),
  ) as boolean;
  if (!ok) throw new ApiError("rate_limited", "Zu viele Eingaben, bitte kurz warten");
}

export async function pruneRateLimits(): Promise<number> {
  return check(await db().rpc("prune_rate_limits")) as number;
}
