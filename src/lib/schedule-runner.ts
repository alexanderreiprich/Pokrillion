import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionCategory } from "@/lib/content/schema";
import { formatIsoDate, parseIsoDate, puzzleNumber } from "@/lib/game/puzzle-date";
import { planPuzzle, type PlannableQuestion } from "@/lib/game/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/**
 * Makes sure puzzles exist for `days` days starting at `from`. Existing days are left alone.
 * Used by `npm run schedule` and the Vercel cron route. Returns the newly planned dates.
 */
export async function ensureSchedule(
  client: SupabaseClient,
  from: string,
  days: number,
): Promise<{ date: string; number: number; questions: string[] }[]> {
  const start = parseIsoDate(from);
  if (start === null) throw new Error(`Ungültiges Datum: ${from}`);

  const questions = (
    check(
      await client
        .from("questions")
        .select("id, category, question_group, difficulty, cooldown_days")
        .eq("active", true),
    ) as { id: string; category: QuestionCategory; question_group: string | null; difficulty: number; cooldown_days: number }[]
  ).map(
    (q): PlannableQuestion => ({
      id: q.id,
      category: q.category,
      group: q.question_group,
      difficulty: q.difficulty,
      cooldownDays: q.cooldown_days,
    }),
  );

  const history = check(
    await client.from("puzzle_questions").select("puzzle_date, question_id"),
  ) as { puzzle_date: string; question_id: string }[];
  const planned = new Set(history.map((h) => h.puzzle_date));

  const created: { date: string; number: number; questions: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const date = formatIsoDate(start + i * DAY_MS);
    const number = puzzleNumber(date);
    if (number < 1 || planned.has(date)) continue;

    const lastUsed = new Map<string, string>();
    for (const h of history) {
      if (h.puzzle_date >= date) continue;
      const prev = lastUsed.get(h.question_id);
      if (!prev || h.puzzle_date > prev) lastUsed.set(h.question_id, h.puzzle_date);
    }

    const ids = planPuzzle(date, questions, lastUsed);
    check(await client.from("puzzles").insert({ puzzle_date: date, number }));
    check(
      await client
        .from("puzzle_questions")
        .insert(ids.map((question_id, idx) => ({ puzzle_date: date, position: idx + 1, question_id }))),
    );
    history.push(...ids.map((question_id) => ({ puzzle_date: date, question_id })));
    created.push({ date, number, questions: ids });
  }
  return created;
}
