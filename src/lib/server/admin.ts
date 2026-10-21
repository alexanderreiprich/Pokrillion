import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/server";
import type { EntityRef, Names } from "@/lib/api/types";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { ENTITY_KINDS, type QuestionCategory } from "@/lib/content/schema";
import { MIN_ANSWERS_FOR_CALIBRATION, suggestFamiliarity } from "@/lib/game/calibration";
import { closestEntities, matchInput } from "@/lib/game/match";
import { answerShare, scoreAnswer } from "@/lib/game/scoring";
import { answerPriors, entityRefs, questionCatalog, universeIndex } from "./content";

/**
 * Read-only data for the curation view. The proxy already enforces Basic auth; this checks
 * again right next to the data, so a misconfigured matcher can't expose anything.
 */
export async function requireAdmin(): Promise<void> {
  const h = await headers();
  if (!isAdminAuthorized(h.get("authorization"), process.env.ADMIN_PASSWORD)) notFound();
}

export const RANGES = { "7": 7, "30": 30, all: 0 } as const;
export type Range = keyof typeof RANGES;

export function parseRange(value: string | string[] | undefined): Range {
  return typeof value === "string" && value in RANGES ? (value as Range) : "30";
}

function since(range: Range): string {
  const days = RANGES[range];
  return days === 0 ? "1970-01-01T00:00:00Z" : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** content/familiarity/ and content/aliases/ use one file per entity kind: pokemon, moves, items, … */
const fileFor = (entityId: string) => {
  const kind = entityId.split(":")[0];
  return kind === "pokemon" ? kind : `${kind}s`;
};

// --- overview ----------------------------------------------------------------

export interface DailyRow {
  day: string;
  plays: number;
  finished: number;
  avg_score: number | null;
  endless_runs: number;
  endless_answers: number;
}

export async function dailyOverview(range: Range): Promise<DailyRow[]> {
  return check(await db().rpc("admin_daily", { p_since: since(range) })) as DailyRow[];
}

// --- unknown inputs ------------------------------------------------------------

export interface UnknownInput {
  normalized: string;
  sample: string;
  n: number;
  questions: { id: string; prompt: Names }[];
  /** The input names an entity of another kind (e.g. a Pokémon on a move question) – no data gap. */
  elsewhere: EntityRef | null;
  suggestions: (EntityRef & { distance: number })[];
}

/** Alias suggestions further away than this are shown, but never offered as YAML. */
const ALIAS_MAX_DISTANCE = 2;

export async function unknownInputs(range: Range, limit = 100): Promise<UnknownInput[]> {
  const rows = check(await db().rpc("admin_unknown_inputs", { p_since: since(range), p_limit: limit })) as {
    normalized: string;
    sample: string;
    n: number;
    questions: string[];
  }[];
  const [catalog, everything] = await Promise.all([questionCatalog(), universeIndex([...ENTITY_KINDS])]);

  const withSuggestions = await Promise.all(
    rows.map(async (r) => {
      const other = matchInput(everything, r.sample);
      const elsewhereId = other.type === "exact" || other.type === "fuzzy" ? other.entityId : null;
      if (elsewhereId) return { ...r, elsewhereId, closest: [] };
      const kinds = [...new Set(r.questions.flatMap((id) => catalog.get(id)?.universe ?? []))];
      return { ...r, elsewhereId, closest: closestEntities(await universeIndex(kinds), r.sample) };
    }),
  );
  const refs = await entityRefs(
    withSuggestions.flatMap((r) => [...r.closest.map((c) => c.entityId), ...(r.elsewhereId ? [r.elsewhereId] : [])]),
  );

  return withSuggestions.map((r) => ({
    normalized: r.normalized,
    sample: r.sample,
    n: r.n,
    questions: r.questions.map((id) => ({ id, prompt: catalog.get(id)?.prompt ?? { de: id, en: id } })),
    elsewhere: r.elsewhereId ? (refs.get(r.elsewhereId) ?? null) : null,
    suggestions: r.closest.map((c) => ({ ...refs.get(c.entityId)!, distance: c.distance })),
  }));
}

/** `pokemon:charizard: [Glurack]` – grouped per target file. */
export function aliasYaml(items: UnknownInput[]): Record<string, string> {
  const byFile: Record<string, string[]> = {};
  for (const item of items) {
    const top = item.suggestions[0];
    if (!top || top.distance > ALIAS_MAX_DISTANCE) continue;
    const file = fileFor(top.id);
    (byFile[file] ??= []).push(`${top.id}: [${JSON.stringify(item.sample)}]`);
  }
  const header = "# Jede Zeile prüfen: nur echte Schreibvarianten übernehmen, keine Falschantworten.";
  return Object.fromEntries(Object.entries(byFile).map(([file, lines]) => [file, [header, ...lines].join("\n")]));
}

// --- disputed answers --------------------------------------------------------

export interface DisputedAnswer {
  question: { id: string; prompt: Names };
  entity: EntityRef;
  n: number;
}

export async function disputedAnswers(range: Range, limit = 100): Promise<DisputedAnswer[]> {
  const rows = check(await db().rpc("admin_disputed", { p_since: since(range), p_limit: limit })) as {
    question_id: string;
    entity_id: string;
    n: number;
  }[];
  const [catalog, refs] = await Promise.all([questionCatalog(), entityRefs(rows.map((r) => r.entity_id))]);
  return rows.map((r) => ({
    question: { id: r.question_id, prompt: catalog.get(r.question_id)?.prompt ?? { de: r.question_id, en: r.question_id } },
    entity: refs.get(r.entity_id) ?? { id: r.entity_id, names: { de: r.entity_id, en: r.entity_id } },
    n: r.n,
  }));
}

// --- question stats ----------------------------------------------------------

export interface QuestionStat {
  id: string;
  category: QuestionCategory;
  prompt: Names;
  active: boolean;
  answerCount: number;
  answered: number;
  misses: number;
  avgPoints: number | null;
  distinctAnswers: number;
  wrong: number;
  unknown: number;
}

export async function questionStats(range: Range): Promise<QuestionStat[]> {
  const rows = check(await db().rpc("admin_question_stats", { p_since: since(range) })) as {
    question_id: string;
    answered: number;
    misses: number;
    avg_points: number | null;
    distinct_answers: number;
    wrong: number;
    unknown: number;
  }[];
  const byId = new Map(rows.map((r) => [r.question_id, r]));
  const catalog = await questionCatalog();
  const counts = await Promise.all([...catalog.keys()].map(async (id) => [id, (await answerPriors(id)).size] as const));
  const answerCount = new Map(counts);

  return [...catalog.values()]
    .map((q) => {
      const r = byId.get(q.id);
      return {
        id: q.id,
        category: q.category,
        prompt: q.prompt,
        active: q.active,
        answerCount: answerCount.get(q.id) ?? 0,
        answered: r?.answered ?? 0,
        misses: r?.misses ?? 0,
        avgPoints: r?.avg_points ?? null,
        distinctAnswers: r?.distinct_answers ?? 0,
        wrong: r?.wrong ?? 0,
        unknown: r?.unknown ?? 0,
      };
    })
    .sort((a, b) => b.answered - a.answered || a.id.localeCompare(b.id));
}

// --- calibration of one question ----------------------------------------------

export interface CalibrationRow {
  entity: EntityRef;
  n: number;
  observedShare: number;
  priorShare: number;
  familiarity: number;
  suggested: number | null;
  /** what the next player would get for this answer */
  pointsNow: number;
  masterball: boolean;
}

export interface QuestionCalibration {
  id: string;
  category: QuestionCategory;
  prompt: Names;
  total: number;
  enoughData: boolean;
  rows: CalibrationRow[];
  /** file (entity kind) → YAML lines with suggested familiarity changes */
  yaml: Record<string, string>;
}

const SHOWN_ANSWERS = 40;
const SUGGESTION_THRESHOLD = 10;

export async function questionCalibration(questionId: string, range: Range): Promise<QuestionCalibration | null> {
  const q = (await questionCatalog()).get(questionId);
  if (!q) return null;

  const [priors, dist] = await Promise.all([
    answerPriors(questionId),
    db()
      .rpc("admin_answer_distribution", { p_question_id: questionId, p_since: since(range) })
      .then((r) => check(r) as { entity_id: string; n: number }[]),
  ]);
  const counts = new Map(dist.map((d) => [d.entity_id, d.n]));
  const total = dist.reduce((sum, d) => sum + d.n, 0);
  const enoughData = total >= MIN_ANSWERS_FOR_CALIBRATION;

  // Everything players named plus the answers the prior expects most.
  const ids = [
    ...new Set([
      ...dist.map((d) => d.entity_id),
      ...[...priors.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    ]),
  ].slice(0, Math.max(SHOWN_ANSWERS, dist.length));

  const entities = check(await db().from("entities").select("id, names, familiarity").in("id", ids)) as (EntityRef & {
    familiarity: number;
  })[];
  const byId = new Map(entities.map((e) => [e.id, e]));

  const rows: CalibrationRow[] = ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const e = byId.get(id)!;
      const n = counts.get(id) ?? 0;
      const priorShare = priors.get(id) ?? 0;
      const observedShare = total > 0 ? n / total : 0;
      return {
        entity: { id, names: e.names },
        n,
        observedShare,
        priorShare,
        familiarity: e.familiarity,
        suggested: enoughData ? suggestFamiliarity(e.familiarity, priorShare, answerShare(priorShare, n, total)) : null,
        pointsNow: scoreAnswer({ entityId: id, masterballId: q.masterballId, priorShare, count: n, total }),
        masterball: id === q.masterballId,
      };
    })
    .sort((a, b) => b.n - a.n || answerShare(b.priorShare, 0, 0) - answerShare(a.priorShare, 0, 0));

  const yaml: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.suggested === null || Math.abs(r.suggested - r.familiarity) < SUGGESTION_THRESHOLD) continue;
    (yaml[fileFor(r.entity.id)] ??= []).push(`${r.entity.id}: ${r.suggested}   # bisher ${r.familiarity}`);
  }

  return {
    id: q.id,
    category: q.category,
    prompt: q.prompt,
    total,
    enoughData,
    rows,
    yaml: Object.fromEntries(Object.entries(yaml).map(([k, v]) => [k, v.join("\n")])),
  };
}
