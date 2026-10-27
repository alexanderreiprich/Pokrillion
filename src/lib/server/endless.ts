import "server-only";
import { db } from "@/lib/db/server";
import type {
  EndlessResult,
  EndlessRunResponse,
  EndlessTimeoutResponse,
  GuessResponse,
  StartQuestionResponse,
} from "@/lib/api/types";
import type { Locale } from "@/lib/content/schema";
import { ENDLESS_LIVES, pickEndlessQuestion } from "@/lib/game/endless";
import { formatIsoDate } from "@/lib/game/puzzle-date";
import { scoreAnswer } from "@/lib/game/scoring";
import { tierForPoints } from "@/lib/game/tiers";
import { isExpired, remainingSeconds, WRONG_GUESS_PENALTY_S } from "@/lib/game/timer";
import { entityRefs, questionCatalog, type CatalogQuestion } from "./content";
import { ApiError } from "./http";
import { judge } from "./judge";

interface RunRow {
  id: string;
  player_id: string;
  lives: number;
  score: number;
  ended_at: string | null;
}

interface RunQuestionRow {
  seq: number;
  question_id: string;
  started_at: string;
  penalty_s: number;
  answered_at: string | null;
  entity_id: string | null;
  points: number | null;
}

const RUN_COLUMNS = "id, player_id, lives, score, ended_at";
const QUESTION_COLUMNS = "seq, question_id, started_at, penalty_s, answered_at, entity_id, points";
const DAY_MS = 24 * 60 * 60 * 1000;

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

async function requireRun(runId: string, playerId: string): Promise<RunRow> {
  const run = check(await db().from("endless_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle()) as RunRow | null;
  if (!run || run.player_id !== playerId) throw new ApiError("not_found", "Unbekannte Runde");
  return run;
}

async function runQuestions(runId: string): Promise<RunQuestionRow[]> {
  return check(
    await db().from("endless_questions").select(QUESTION_COLUMNS).eq("run_id", runId).order("seq"),
  ) as RunQuestionRow[];
}

async function catalogEntry(questionId: string): Promise<CatalogQuestion> {
  const q = (await questionCatalog()).get(questionId);
  if (!q) throw new Error(`Frage ${questionId} fehlt im Katalog`);
  return q;
}

function timerOf(row: RunQuestionRow, q: CatalogQuestion) {
  return { startedAt: new Date(row.started_at), timeLimitS: q.timeLimitS, penaltyS: row.penalty_s };
}

async function toResults(rows: RunQuestionRow[]): Promise<EndlessResult[]> {
  const catalog = await questionCatalog();
  const answered = rows.filter((r) => r.answered_at);
  const refs = await entityRefs(
    answered.flatMap((r) => [catalog.get(r.question_id)!.masterballId, ...(r.entity_id ? [r.entity_id] : [])]),
  );
  return answered.map((r) => {
    const q = catalog.get(r.question_id)!;
    const points = r.points ?? 0;
    return {
      position: r.seq,
      points,
      tier: tierForPoints(points).id,
      entity: r.entity_id ? (refs.get(r.entity_id) ?? null) : null,
      category: q.category,
      prompt: q.prompt,
      masterball: refs.get(q.masterballId)!,
    };
  });
}

async function runResponse(run: RunRow): Promise<EndlessRunResponse> {
  const rows = await runQuestions(run.id);
  return {
    runId: run.id,
    lives: run.lives,
    maxLives: ENDLESS_LIVES,
    score: run.score,
    results: await toResults(rows),
    openSeq: run.ended_at ? null : (rows.find((r) => !r.answered_at)?.seq ?? null),
    ended: run.ended_at !== null,
  };
}

// --- use cases ---------------------------------------------------------------

export async function startRun(locale: Locale, playerId: string): Promise<EndlessRunResponse> {
  // Only one open run per player: starting a new one abandons the old.
  check(
    await db()
      .from("endless_runs")
      .update({ ended_at: new Date().toISOString() })
      .eq("player_id", playerId)
      .is("ended_at", null),
  );
  const run = check(
    await db()
      .from("endless_runs")
      .insert({ player_id: playerId, locale, lives: ENDLESS_LIVES })
      .select(RUN_COLUMNS)
      .single(),
  ) as RunRow;
  return runResponse(run);
}

/** The player's open run, or null (to offer "continue"). */
export async function currentRun(playerId: string): Promise<EndlessRunResponse | null> {
  const run = check(
    await db()
      .from("endless_runs")
      .select(RUN_COLUMNS)
      .eq("player_id", playerId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as RunRow | null;
  return run ? runResponse(run) : null;
}

export async function getRun(runId: string, playerId: string): Promise<EndlessRunResponse> {
  return runResponse(await requireRun(runId, playerId));
}

/** Reveals the next question (or resumes the open one) and starts its timer. */
export async function nextQuestion(runId: string, playerId: string): Promise<StartQuestionResponse> {
  const run = await requireRun(runId, playerId);
  if (run.ended_at) throw new ApiError("ended", "Die Runde ist vorbei");
  const rows = await runQuestions(runId);

  let row = rows.find((r) => !r.answered_at);
  if (!row) {
    const catalog = await questionCatalog();
    const today = Date.now();
    const daily = check(
      await db()
        .from("puzzle_questions")
        .select("question_id")
        .gte("puzzle_date", formatIsoDate(today - DAY_MS))
        .lte("puzzle_date", formatIsoDate(today + DAY_MS)),
    ) as { question_id: string }[];

    const questionId = pickEndlessQuestion(
      [...catalog.values()].filter((q) => q.active).map((q) => q.id),
      new Set(rows.map((r) => r.question_id)),
      new Set(daily.map((d) => d.question_id)),
    );
    if (!questionId) {
      check(await db().from("endless_runs").update({ ended_at: new Date().toISOString() }).eq("id", runId));
      throw new ApiError("exhausted", "Alle Fragen beantwortet");
    }

    const inserted = await db()
      .from("endless_questions")
      .insert({ run_id: runId, seq: rows.length + 1, question_id: questionId })
      .select(QUESTION_COLUMNS)
      .single();
    // A parallel request may have inserted first; then resume that one.
    row = inserted.error
      ? (await runQuestions(runId)).find((r) => !r.answered_at)
      : (inserted.data as RunQuestionRow);
    if (!row) throw new Error(inserted.error?.message ?? "endless_questions insert failed");
  }

  const q = await catalogEntry(row.question_id);
  return {
    position: row.seq,
    category: q.category,
    prompt: q.prompt,
    timeLimitS: q.timeLimitS,
    remainingS: Math.max(0, remainingSeconds(timerOf(row, q))),
  };
}

async function openQuestion(runId: string, playerId: string, seq: number, rateLimit: Promise<void>) {
  const [run, rows] = await Promise.all([requireRun(runId, playerId), runQuestions(runId), rateLimit]);
  if (run.ended_at) throw new ApiError("ended", "Die Runde ist vorbei");
  const row = rows.find((r) => r.seq === seq);
  if (!row) throw new ApiError("not_started", "Frage wurde nicht gestartet");
  if (row.answered_at) throw new ApiError("already_answered", "Diese Frage ist schon beantwortet");
  return { run, row, q: await catalogEntry(row.question_id) };
}

/** `rateLimit` is the pending rate-limit check: reads run alongside it, writes wait for it. */
export async function submitEndlessGuess(
  runId: string,
  playerId: string,
  seq: number,
  rawInput: string,
  rateLimit: Promise<void>,
): Promise<GuessResponse> {
  const { run, row, q } = await openQuestion(runId, playerId, seq, rateLimit);

  if (isExpired(timerOf(row, q))) {
    const res = await timeoutEndless(runId, playerId, seq);
    return { result: "timeout", finished: res.finished };
  }

  const { input, normalized, outcome, priors } = await judge(q, rawInput);
  const entityId = outcome.result === "unknown" ? null : outcome.entityId;
  const logGuess = async (result: string, points: number | null) =>
    check(
      await db()
        .from("endless_guesses")
        .insert({ run_id: runId, seq, raw_input: input, normalized, entity_id: entityId, result, points }),
    );

  if (outcome.result === "valid") {
    const counts = check(
      await db().rpc("lock_endless_answer", { p_run_id: runId, p_seq: seq, p_entity_id: outcome.entityId }),
    ) as { n: number; total: number }[];
    if (counts.length === 0) throw new ApiError("already_answered", "Diese Frage ist schon beantwortet");

    const points = scoreAnswer({
      entityId: outcome.entityId,
      masterballId: q.masterballId,
      priorShare: priors.get(outcome.entityId) ?? 0,
      // All-time counts include this answer; scoring wants the other players only.
      count: counts[0].n - 1,
      total: counts[0].total - 1,
    });
    const savePoints = async () =>
      check(await db().from("endless_questions").update({ points }).eq("run_id", runId).eq("seq", seq));
    const saveScore = async () =>
      check(await db().from("endless_runs").update({ score: run.score + points }).eq("id", runId));
    const [refs] = await Promise.all([
      entityRefs([outcome.entityId]),
      savePoints(),
      saveScore(),
      logGuess("valid", points),
    ]);
    return {
      result: "valid",
      entity: refs.get(outcome.entityId)!,
      points,
      tier: tierForPoints(points).id,
      corrected: outcome.corrected,
      finished: false,
    };
  }

  // Read before logging this guess, or it would count as its own duplicate.
  const previous = check(
    await db().from("endless_guesses").select("normalized, entity_id").eq("run_id", runId).eq("seq", seq),
  ) as { normalized: string; entity_id: string | null }[];
  const duplicate = previous.some((g) => g.normalized === normalized || (entityId && g.entity_id === entityId));

  const penaltyS = duplicate ? row.penalty_s : row.penalty_s + WRONG_GUESS_PENALTY_S;
  const addPenalty = async () =>
    check(await db().from("endless_questions").update({ penalty_s: penaltyS }).eq("run_id", runId).eq("seq", seq));
  const [refs] = await Promise.all([
    !duplicate && outcome.result === "wrong_entity" ? entityRefs([outcome.entityId]) : null,
    duplicate ? null : addPenalty(),
    logGuess(duplicate ? "duplicate_wrong" : outcome.result, null),
  ]);

  const remainingS = Math.max(0, remainingSeconds({ ...timerOf(row, q), penaltyS }));
  if (duplicate) return { result: "duplicate_wrong", remainingS };
  if (outcome.result === "wrong_entity") {
    return { result: "wrong_entity", entity: refs!.get(outcome.entityId)!, remainingS };
  }
  return { result: "unknown", remainingS };
}

/** Timer ran out: the question scores 0 and the run loses a life. */
export async function timeoutEndless(runId: string, playerId: string, seq: number): Promise<EndlessTimeoutResponse> {
  await requireRun(runId, playerId);
  check(await db().rpc("endless_timeout", { p_run_id: runId, p_seq: seq }));

  const run = await requireRun(runId, playerId);
  const result = (await toResults(await runQuestions(runId))).find((r) => r.position === seq);
  if (!result) throw new ApiError("not_started", "Frage wurde nicht gestartet");
  return { result, lives: run.lives, finished: run.ended_at !== null };
}
