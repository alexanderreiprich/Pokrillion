import { db } from "@/lib/db/server";
import { formatIsoDate } from "@/lib/game/puzzle-date";
import { ensureSchedule } from "@/lib/schedule-runner";
import { ApiError, respond } from "@/lib/server/http";
import { pruneRateLimits } from "@/lib/server/rate-limit";

/** Vercel Cron (see vercel.json): keeps two weeks of puzzles planned ahead, prunes old rate-limit rows. */
export async function GET(request: Request) {
  return respond(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new ApiError("unauthorized", "Falsches oder fehlendes CRON_SECRET");
    }
    const from = formatIsoDate(Date.now() - 24 * 60 * 60 * 1000);
    const created = await ensureSchedule(db(), from, 15);
    const pruned = await pruneRateLimits();
    return { created: created.map((p) => p.date), pruned };
  });
}
