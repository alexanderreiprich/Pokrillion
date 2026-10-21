import { formatIsoDate, parseIsoDate } from "./puzzle-date";

/** Finished days (ISO date → score), kept in localStorage by the game UI. */
export type History = Record<string, number>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Consecutive played days ending at `today` (or yesterday, if today isn't played yet). */
export function currentStreak(history: History, today: string): number {
  let ts = parseIsoDate(today);
  if (ts === null) return 0;
  if (!(today in history)) ts -= DAY_MS;
  let streak = 0;
  while (formatIsoDate(ts) in history) {
    streak++;
    ts -= DAY_MS;
  }
  return streak;
}
