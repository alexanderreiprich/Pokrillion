/** Endless mode: random questions until all lives are lost. A timeout costs one life. */
export const ENDLESS_LIVES = 3;

/**
 * Picks the next question of an endless run, or null when the bank is exhausted.
 * - never repeats a question within the run
 * - avoids questions of the current daily puzzles (no spoilers) unless nothing else is left
 */
export function pickEndlessQuestion(
  activeIds: readonly string[],
  askedInRun: ReadonlySet<string>,
  dailyIds: ReadonlySet<string>,
  random: () => number = Math.random,
): string | null {
  const fresh = activeIds.filter((id) => !askedInRun.has(id));
  const preferred = fresh.filter((id) => !dailyIds.has(id));
  const pool = preferred.length > 0 ? preferred : fresh;
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)];
}
