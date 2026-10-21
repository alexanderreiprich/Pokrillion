/** Day of Pokrillion #1. */
export const LAUNCH_DATE = "2026-10-21";

export const QUESTIONS_PER_PUZZLE = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` as a UTC midnight timestamp, or null if invalid. */
export function parseIsoDate(date: string): number | null {
  if (!ISO_DATE.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const ts = Date.UTC(y, m - 1, d);
  const back = new Date(ts);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return ts;
}

export function formatIsoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** The player's local calendar date. Puzzles switch at the player's midnight, like Wordle. */
export function localIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Pokrillion #N for a date (1-based). Dates before launch yield values < 1. */
export function puzzleNumber(date: string): number {
  const ts = parseIsoDate(date);
  if (ts === null) throw new Error(`Ungültiges Datum: ${date}`);
  return Math.round((ts - parseIsoDate(LAUNCH_DATE)!) / DAY_MS) + 1;
}

/**
 * A client-sent date is plausible if it is "today" somewhere on earth (UTC−12 … UTC+14),
 * i.e. within one day of the current UTC date, and not before launch.
 */
export function isPlayableDate(date: string, now: Date = new Date()): boolean {
  const ts = parseIsoDate(date);
  if (ts === null || puzzleNumber(date) < 1) return false;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(ts - todayUtc) <= DAY_MS;
}
