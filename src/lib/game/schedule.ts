import type { QuestionCategory } from "@/lib/content/schema";
import { parseIsoDate, QUESTIONS_PER_PUZZLE } from "./puzzle-date";

/**
 * Picks the questions for one day. See docs/KONZEPT.md §1 (daily mix) and §8 (planning rules).
 *
 * - category quotas first (MIN_PER_CATEGORY), then the remaining slots from any category
 * - never two questions of the same `group` on one day
 * - questions outside their cooldown are preferred; if the pool is too small the least
 *   recently used ones fill up (so a small question bank still yields a puzzle)
 * - sorted by difficulty, so the day gets a little harder towards the end
 * - deterministic per date: planning the same day twice gives the same result
 */
export const MIN_PER_CATEGORY: Partial<Record<QuestionCategory, number>> = {
  pokedex: 3,
  games: 3,
};

export interface PlannableQuestion {
  id: string;
  category: QuestionCategory;
  group?: string | null;
  difficulty: number;
  cooldownDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function planPuzzle(
  date: string,
  questions: PlannableQuestion[],
  /** question id → ISO date it was last scheduled */
  lastUsed: ReadonlyMap<string, string>,
): string[] {
  const day = parseIsoDate(date);
  if (day === null) throw new Error(`Ungültiges Datum: ${date}`);

  const random = seededRandom(date);
  const ranked = questions
    .map((q) => {
      const used = lastUsed.get(q.id);
      const usedTs = used ? parseIsoDate(used)! : -Infinity;
      return { q, fresh: day - usedTs >= q.cooldownDays * DAY_MS, usedTs, tiebreak: random() };
    })
    // Never plan a question twice for the same day or schedule into the past of its last use.
    .filter((c) => c.usedTs < day)
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || a.usedTs - b.usedTs || a.tiebreak - b.tiebreak);

  const picked: typeof ranked = [];
  const groups = new Set<string>();
  const take = (c: (typeof ranked)[number]) => {
    picked.push(c);
    groups.add(c.q.group ?? `#${c.q.id}`);
  };
  const available = (c: (typeof ranked)[number]) => !picked.includes(c) && !groups.has(c.q.group ?? `#${c.q.id}`);

  for (const [category, min] of Object.entries(MIN_PER_CATEGORY)) {
    for (const c of ranked) {
      if (picked.filter((p) => p.q.category === category).length >= min!) break;
      if (c.q.category === category && available(c)) take(c);
    }
  }
  for (const c of ranked) {
    if (picked.length >= QUESTIONS_PER_PUZZLE) break;
    if (available(c)) take(c);
  }

  if (picked.length < QUESTIONS_PER_PUZZLE) {
    throw new Error(
      `Für ${date} lassen sich nur ${picked.length} von ${QUESTIONS_PER_PUZZLE} Fragen planen ` +
        `(zu wenige aktive Fragen oder zu viele mit derselben group).`,
    );
  }

  return picked
    .sort((a, b) => a.q.difficulty - b.q.difficulty || a.tiebreak - b.tiebreak)
    .map((c) => c.q.id);
}

/** mulberry32 seeded from the date string. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
