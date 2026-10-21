import "server-only";
import { db } from "@/lib/db/server";
import type {
  AnswerStat,
  GuessResponse,
  PlayResponse,
  QuestionResult,
  StartQuestionResponse,
  SummaryResponse,
  TimeoutResponse,
} from "@/lib/api/types";
import type { Locale } from "@/lib/content/schema";
import { evaluateGuess } from "@/lib/game/guess";
import { normalize } from "@/lib/game/normalize";
import { isPlayableDate } from "@/lib/game/puzzle-date";
import { scoreAnswer } from "@/lib/game/scoring";
import { tierForPoints } from "@/lib/game/tiers";
import { isExpired, remainingSeconds, WRONG_GUESS_PENALTY_S } from "@/lib/game/timer";
import { answerPriors, entityRefs, loadPuzzle, universeIndex, type Puzzle, type PuzzleQuestion } from "./content";
import { ApiError } from "./http";

const MAX_INPUT_LENGTH = 100;
const TOP_ANSWERS = 5;

interface PlayRow {
  id: string;
  puzzle_date: string;
  player_id: string;
  finished_at: string | null;
  total_score: number | null;
}

interface PlayQuestionRow {
  position: number;
  started_at: string;
  penalty_s: number;
  answered_at: string | null;
  entity_id: string | null;
  points: number | null;
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

async function requirePuzzle(date: string): Promise<Puzzle> {
  const puzzle = await loadPuzzle(date);
  if (!puzzle) throw new ApiError("no_puzzle", `Für ${date} gibt es noch kein Rätsel`);
  return puzzle;
}

async function requirePlay(playId: string, playerId: string): Promise<PlayRow> {
  const play = check(
    await db()
      .from("plays")
      .select("id, puzzle_date, player_id, finished_at, total_score")
      .eq("id", playId)
      .maybeSingle(),
  ) as PlayRow | null;
  // Someone else's play looks exactly like a missing one.
  if (!play || play.player_id !== playerId) throw new ApiError("not_found", "Unbekanntes Spiel");
  return play;
}

async function playQuestions(playId: string): Promise<PlayQuestionRow[]> {
  return check(
    await db()
      .from("play_questions")
      .select("position, started_at, penalty_s, answered_at, entity_id, points")
      .eq("play_id", playId)
      .order("position"),
  ) as PlayQuestionRow[];
}

function questionAt(puzzle: Puzzle, position: number): PuzzleQuestion {
  const q = puzzle.questions.find((pq) => pq.position === position);
  if (!q) throw new ApiError("not_found", "Unbekannte Frage");
  return q;
}

function timerOf(row: PlayQuestionRow, q: PuzzleQuestion) {
  return { startedAt: new Date(row.started_at), timeLimitS: q.timeLimitS, penaltyS: row.penalty_s };
}

async function toResults(rows: PlayQuestionRow[]): Promise<QuestionResult[]> {
  const answered = rows.filter((r) => r.answered_at);
  const refs = await entityRefs(answered.flatMap((r) => (r.entity_id ? [r.entity_id] : [])));
  return answered.map((r) => {
    const points = r.points ?? 0;
    return {
      position: r.position,
      points,
      tier: tierForPoints(points).id,
      entity: r.entity_id ? (refs.get(r.entity_id) ?? null) : null,
    };
  });
}

async function finish(playId: string, questionCount: number): Promise<boolean> {
  const total = check(
    await db().rpc("finish_play", { p_play_id: playId, p_question_count: questionCount }),
  ) as number | null;
  return total !== null;
}

/** Marks an open question as missed (0 points). */
async function markTimeout(playId: string, position: number): Promise<void> {
  check(
    await db()
      .from("play_questions")
      .update({ answered_at: new Date().toISOString(), points: 0 })
      .eq("play_id", playId)
      .eq("position", position)
      .is("answered_at", null),
  );
}

// --- use cases ---------------------------------------------------------------

export async function startPlay(date: string, locale: Locale, playerId: string): Promise<PlayResponse> {
  if (!isPlayableDate(date)) throw new ApiError("invalid_date", `${date} ist heute nirgends auf der Welt`);
  const puzzle = await requirePuzzle(date);

  check(
    await db()
      .from("plays")
      .upsert(
        { puzzle_date: date, player_id: playerId, locale },
        { onConflict: "puzzle_date,player_id", ignoreDuplicates: true },
      ),
  );
  const play = check(
    await db()
      .from("plays")
      .select("id, puzzle_date, player_id, finished_at, total_score")
      .eq("puzzle_date", date)
      .eq("player_id", playerId)
      .single(),
  ) as PlayRow;

  const rows = await playQuestions(play.id);
  const results = await toResults(rows);
  return {
    playId: play.id,
    date: puzzle.date,
    number: puzzle.number,
    questionCount: puzzle.questions.length,
    results,
    openPosition: rows.find((r) => !r.answered_at)?.position ?? null,
    finished: play.finished_at !== null,
    totalScore: results.reduce((sum, r) => sum + r.points, 0),
  };
}

export async function startQuestion(playId: string, playerId: string, position: number): Promise<StartQuestionResponse> {
  const play = await requirePlay(playId, playerId);
  const puzzle = await requirePuzzle(play.puzzle_date);
  const q = questionAt(puzzle, position);
  const rows = await playQuestions(playId);

  let row = rows.find((r) => r.position === position);
  if (row?.answered_at) throw new ApiError("already_answered", "Diese Frage ist schon beantwortet");
  if (!row) {
    const open = rows.find((r) => !r.answered_at);
    if (open) throw new ApiError("out_of_order", `Frage ${open.position} ist noch offen`);
    if (rows.length !== position - 1) throw new ApiError("out_of_order", `Als Nächstes ist Frage ${rows.length + 1} dran`);
    const inserted = await db()
      .from("play_questions")
      .insert({ play_id: playId, position })
      .select("position, started_at, penalty_s, answered_at, entity_id, points")
      .single();
    // A parallel request may have created the row first; then just resume it.
    row = inserted.error
      ? (await playQuestions(playId)).find((r) => r.position === position)
      : (inserted.data as PlayQuestionRow);
    if (!row) throw new Error(inserted.error?.message ?? "play_questions insert failed");
  }

  return {
    position,
    category: q.category,
    prompt: q.prompt,
    timeLimitS: q.timeLimitS,
    remainingS: Math.max(0, remainingSeconds(timerOf(row, q))),
  };
}

export async function submitGuess(
  playId: string,
  playerId: string,
  position: number,
  rawInput: string,
): Promise<GuessResponse> {
  const input = rawInput.trim().slice(0, MAX_INPUT_LENGTH);
  const normalized = normalize(input);
  if (!normalized) throw new ApiError("bad_request", "Leere Eingabe");

  const play = await requirePlay(playId, playerId);
  const puzzle = await requirePuzzle(play.puzzle_date);
  const q = questionAt(puzzle, position);
  const row = (await playQuestions(playId)).find((r) => r.position === position);
  if (!row) throw new ApiError("not_started", "Frage wurde nicht gestartet");
  if (row.answered_at) throw new ApiError("already_answered", "Diese Frage ist schon beantwortet");

  if (isExpired(timerOf(row, q))) {
    await markTimeout(playId, position);
    return { result: "timeout", finished: await finish(playId, puzzle.questions.length) };
  }

  const [index, priors] = await Promise.all([universeIndex(q.universe), answerPriors(q.id)]);
  const outcome = evaluateGuess(index, new Set(priors.keys()), input);
  const entityId = outcome.result === "unknown" ? null : outcome.entityId;

  const logGuess = async (result: string, points: number | null) =>
    check(
      await db().from("guesses").insert({
        play_id: playId,
        position,
        raw_input: input,
        normalized,
        entity_id: entityId,
        result,
        points,
      }),
    );

  if (outcome.result === "valid") {
    const counts = check(
      await db().rpc("lock_answer", { p_play_id: playId, p_position: position, p_entity_id: outcome.entityId }),
    ) as { n: number; total: number }[];
    if (counts.length === 0) throw new ApiError("already_answered", "Diese Frage ist schon beantwortet");

    const points = scoreAnswer({
      entityId: outcome.entityId,
      masterballId: q.masterballId,
      priorShare: priors.get(outcome.entityId) ?? 0,
      // lock_answer counts the guess itself; scoring wants the other players only.
      count: counts[0].n - 1,
      total: counts[0].total - 1,
    });
    check(await db().from("play_questions").update({ points }).eq("play_id", playId).eq("position", position));
    await logGuess("valid", points);

    const refs = await entityRefs([outcome.entityId]);
    return {
      result: "valid",
      entity: refs.get(outcome.entityId)!,
      points,
      tier: tierForPoints(points).id,
      corrected: outcome.corrected,
      finished: await finish(playId, puzzle.questions.length),
    };
  }

  // Wrong: the same input (or another name of the same entity) twice costs nothing extra.
  const previous = check(
    await db().from("guesses").select("normalized, entity_id").eq("play_id", playId).eq("position", position),
  ) as { normalized: string; entity_id: string | null }[];
  const duplicate = previous.some((g) => g.normalized === normalized || (entityId && g.entity_id === entityId));

  let penaltyS = row.penalty_s;
  if (!duplicate) {
    penaltyS += WRONG_GUESS_PENALTY_S;
    check(
      await db().from("play_questions").update({ penalty_s: penaltyS }).eq("play_id", playId).eq("position", position),
    );
  }
  await logGuess(duplicate ? "duplicate_wrong" : outcome.result, null);

  const remainingS = Math.max(0, remainingSeconds({ ...timerOf(row, q), penaltyS }));
  if (duplicate) return { result: "duplicate_wrong", remainingS };
  if (outcome.result === "wrong_entity") {
    const refs = await entityRefs([outcome.entityId]);
    return { result: "wrong_entity", entity: refs.get(outcome.entityId)!, remainingS };
  }
  return { result: "unknown", remainingS };
}

/** Timer ran out on the client (or the player gave up). */
export async function timeoutQuestion(playId: string, playerId: string, position: number): Promise<TimeoutResponse> {
  const play = await requirePlay(playId, playerId);
  const puzzle = await requirePuzzle(play.puzzle_date);
  const row = (await playQuestions(playId)).find((r) => r.position === position);
  if (!row) throw new ApiError("not_started", "Frage wurde nicht gestartet");
  if (!row.answered_at) await markTimeout(playId, position);

  const results = await toResults(await playQuestions(playId));
  return {
    result: results.find((r) => r.position === position)!,
    finished: await finish(playId, puzzle.questions.length),
  };
}

export async function summary(playId: string, playerId: string): Promise<SummaryResponse> {
  const play = await requirePlay(playId, playerId);
  if (!play.finished_at) throw new ApiError("unfinished", "Die Runde läuft noch");
  const puzzle = await requirePuzzle(play.puzzle_date);

  const [results, stats] = await Promise.all([
    playQuestions(playId).then(toResults),
    db()
      .rpc("puzzle_position_stats", { p_date: play.puzzle_date })
      .then((r) => check(r) as { pos: number; entity_id: string | null; n: number }[]),
  ]);
  const answerCounts = await Promise.all(puzzle.questions.map((q) => answerPriors(q.id).then((p) => p.size)));

  const byPosition = new Map<number, { entityId: string | null; n: number }[]>();
  for (const s of stats) {
    byPosition.set(s.pos, [...(byPosition.get(s.pos) ?? []), { entityId: s.entity_id, n: s.n }]);
  }

  const wanted = new Set<string>();
  for (const q of puzzle.questions) {
    wanted.add(q.masterballId);
    (byPosition.get(q.position) ?? [])
      .filter((s) => s.entityId)
      .sort((a, b) => b.n - a.n)
      .slice(0, TOP_ANSWERS)
      .forEach((s) => wanted.add(s.entityId!));
  }
  const refs = await entityRefs(wanted);

  return {
    date: puzzle.date,
    number: puzzle.number,
    totalScore: results.reduce((sum, r) => sum + r.points, 0),
    questions: puzzle.questions.map((q, i) => {
      const rows = byPosition.get(q.position) ?? [];
      const players = rows.reduce((sum, r) => sum + r.n, 0);
      const pct = (entityId: string | null) =>
        players === 0 ? 0 : (100 * (rows.find((r) => r.entityId === entityId)?.n ?? 0)) / players;
      const stat = (entityId: string): AnswerStat => ({ entity: refs.get(entityId)!, pct: pct(entityId) });
      const yours = results.find((r) => r.position === q.position)!;
      return {
        position: q.position,
        category: q.category,
        prompt: q.prompt,
        yours: { ...yours, pct: yours.entity ? pct(yours.entity.id) : null },
        players,
        top: rows
          .filter((r) => r.entityId)
          .sort((a, b) => b.n - a.n)
          .slice(0, TOP_ANSWERS)
          .map((r) => stat(r.entityId!)),
        masterball: stat(q.masterballId),
        answerCount: answerCounts[i],
      };
    }),
  };
}
