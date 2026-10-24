import "server-only";
import { db } from "@/lib/db/server";
import type { EntityRef, Names } from "@/lib/api/types";
import type { QuestionCategory } from "@/lib/content/schema";
import { indexFromAliases, type MatchIndex } from "@/lib/game/match";

/**
 * Read-mostly content (aliases, answer sets, names) only changes with `content:build`,
 * so it is cached in memory per server instance for a few minutes.
 */
const TTL_MS = 10 * 60 * 1000;
const PAGE = 1000; // PostgREST default max rows

function cached<T>(store: Map<string, { at: number; value: Promise<T> }>, key: string, load: () => Promise<T>) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => store.delete(key));
  return value;
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// --- match index -------------------------------------------------------------

const indexCache = new Map<string, { at: number; value: Promise<MatchIndex> }>();

/** Fuzzy-matching index over every entity of the given kinds. */
export function universeIndex(kinds: string[]): Promise<MatchIndex> {
  const key = [...kinds].sort().join(",");
  return cached(indexCache, key, async () => {
    const rows: { alias: string; entity_id: string }[] = [];
    for (const kind of kinds) {
      for (let from = 0; ; from += PAGE) {
        const page = check(
          await db()
            .from("entity_aliases")
            .select("alias, entity_id")
            .like("entity_id", `${kind}:%`)
            .order("alias")
            .order("entity_id")
            .range(from, from + PAGE - 1),
        ) as { alias: string; entity_id: string }[];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
    }
    return indexFromAliases(rows);
  });
}

// --- answer sets -------------------------------------------------------------

const answerCache = new Map<string, { at: number; value: Promise<Map<string, number>> }>();

/** Valid answers of a question → prior share. */
export function answerPriors(questionId: string): Promise<Map<string, number>> {
  return cached(answerCache, questionId, async () => {
    const rows = check(
      await db().from("question_answers").select("entity_id, prior_share").eq("question_id", questionId),
    ) as { entity_id: string; prior_share: number }[];
    return new Map(rows.map((r) => [r.entity_id, r.prior_share]));
  });
}

// --- entity names ------------------------------------------------------------

export async function entityRefs(ids: Iterable<string>): Promise<Map<string, EntityRef>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, EntityRef>();
  for (let i = 0; i < unique.length; i += 200) {
    const rows = check(
      await db().from("entities").select("id, names").in("id", unique.slice(i, i + 200)),
    ) as { id: string; names: Names }[];
    for (const r of rows) out.set(r.id, r);
  }
  return out;
}

// --- puzzles -----------------------------------------------------------------

export interface PuzzleQuestion {
  position: number;
  id: string;
  category: QuestionCategory;
  prompt: Names;
  timeLimitS: number;
  universe: string[];
  masterballId: string;
}

export interface Puzzle {
  date: string;
  number: number;
  questions: PuzzleQuestion[];
}

interface PuzzleRow {
  puzzle_date: string;
  number: number;
  puzzle_questions: {
    position: number;
    questions: {
      id: string;
      category: QuestionCategory;
      prompt: Names;
      time_limit_s: number;
      universe: string[];
      masterball_entity_id: string;
    };
  }[];
}

const puzzleCache = new Map<string, { at: number; value: Promise<Puzzle | null> }>();

export function loadPuzzle(date: string): Promise<Puzzle | null> {
  return cached(puzzleCache, date, async () => {
    const row = check(
      await db()
        .from("puzzles")
        .select(
          "puzzle_date, number, puzzle_questions(position, questions(id, category, prompt, time_limit_s, universe, masterball_entity_id))",
        )
        .eq("puzzle_date", date)
        .maybeSingle(),
    ) as PuzzleRow | null;
    if (!row) {
      // Don't cache misses for long: the scheduler may create the puzzle any moment.
      setTimeout(() => puzzleCache.delete(date), 5_000);
      return null;
    }
    return {
      date: row.puzzle_date,
      number: row.number,
      questions: row.puzzle_questions
        .map((pq) => ({
          position: pq.position,
          id: pq.questions.id,
          category: pq.questions.category,
          prompt: pq.questions.prompt,
          timeLimitS: pq.questions.time_limit_s,
          universe: pq.questions.universe,
          masterballId: pq.questions.masterball_entity_id,
        }))
        .sort((a, b) => a.position - b.position),
    };
  });
}

// --- question catalog (endless mode) ----------------------------------------

export interface CatalogQuestion extends Omit<PuzzleQuestion, "position"> {
  active: boolean;
}

const catalogCache = new Map<string, { at: number; value: Promise<Map<string, CatalogQuestion>> }>();

/** All questions by id. */
export function questionCatalog(): Promise<Map<string, CatalogQuestion>> {
  return cached(catalogCache, "all", async () => {
    const rows = check(
      await db().from("questions").select("id, category, prompt, time_limit_s, universe, masterball_entity_id, active"),
    ) as {
      id: string;
      category: QuestionCategory;
      prompt: Names;
      time_limit_s: number;
      universe: string[];
      masterball_entity_id: string;
      active: boolean;
    }[];
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          category: r.category,
          prompt: r.prompt,
          timeLimitS: r.time_limit_s,
          universe: r.universe,
          masterballId: r.masterball_entity_id,
          active: r.active,
        },
      ]),
    );
  });
}
