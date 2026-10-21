import { normalize } from "@/lib/game/normalize";
import { priorShares } from "@/lib/game/scoring";
import type { AnswerQuery, Entity, EntityKind, Question } from "./schema";

export interface ResolvedQuestion extends Question {
  universe: EntityKind[];
  /** entity id → prior share; sums to 1 */
  answerPriors: Record<string, number>;
}

export interface ContentProblem {
  level: "error" | "warning";
  where: string;
  message: string;
}

type AttrValue = Entity["attrs"][string];

function attrMatches(actual: AttrValue | undefined, wanted: AttrValue): boolean {
  if (actual === undefined) return false;
  const actualList = Array.isArray(actual) ? actual : [actual];
  const wantedList = Array.isArray(wanted) ? wanted : [wanted];
  return wantedList.some((w) => actualList.includes(w as never));
}

export function matchesQuery(entity: Entity, query: AnswerQuery): boolean {
  if (entity.kind !== query.kind) return false;
  for (const [key, wanted] of Object.entries(query.where ?? {})) {
    if (!attrMatches(entity.attrs[key], wanted)) return false;
  }
  if (query.idMatches && !new RegExp(query.idMatches).test(entity.id)) return false;
  if (query.nameMatches) {
    const re = new RegExp(query.nameMatches, "i");
    if (!re.test(entity.names.de) && !re.test(entity.names.en)) return false;
  }
  return true;
}

/**
 * Turns question definitions into explicit answer sets with prior shares and checks
 * everything a curator can get wrong (typos in ids, masterball outside the set, …).
 */
export function resolveContent(
  entities: Entity[],
  questions: Question[],
): { questions: ResolvedQuestion[]; problems: ContentProblem[] } {
  const problems: ContentProblem[] = [];
  const byId = new Map<string, Entity>();
  for (const e of entities) {
    if (byId.has(e.id)) problems.push({ level: "error", where: e.id, message: "doppelte Entity-ID" });
    byId.set(e.id, e);
  }

  const seenQuestions = new Set<string>();
  const resolved: ResolvedQuestion[] = [];

  for (const q of questions) {
    const where = q.id;
    const error = (message: string) => problems.push({ level: "error", where, message });
    const warn = (message: string) => problems.push({ level: "warning", where, message });

    if (seenQuestions.has(q.id)) error("doppelte Fragen-ID");
    seenQuestions.add(q.id);

    const ids = new Set<string>();
    const queries = q.answers.query ? [q.answers.query].flat() : [];
    for (const query of queries) {
      for (const e of entities) if (matchesQuery(e, query)) ids.add(e.id);
    }
    for (const id of [...(q.answers.list ?? []), ...q.answers.include]) {
      if (!byId.has(id)) error(`unbekannte Entity ${id}`);
      else ids.add(id);
    }
    for (const id of q.answers.exclude) {
      if (!byId.has(id)) warn(`exclude: unbekannte Entity ${id}`);
      else if (!ids.delete(id)) warn(`exclude: ${id} war gar nicht in der Lösungsmenge`);
    }

    if (ids.size === 0) error("leere Lösungsmenge");
    else if (ids.size < 8) warn(`nur ${ids.size} Antworten – Seltenheit lässt sich kaum abstufen`);
    if (!ids.has(q.masterball)) error(`Meisterball-Antwort ${q.masterball} ist nicht in der Lösungsmenge`);

    const universe = q.universe ?? [...new Set([...ids].map((id) => byId.get(id)!.kind))];
    problems.push(...findNameCollisions(q.id, entities, universe, ids));

    const shares = priorShares(new Map([...ids].sort().map((id) => [id, byId.get(id)!.familiarity])));
    resolved.push({ ...q, universe, answerPriors: Object.fromEntries(shares) });
  }

  return { questions: resolved, problems };
}

/** A normalized name shared by a valid and an invalid entity makes the guess ambiguous. */
function findNameCollisions(
  questionId: string,
  entities: Entity[],
  universe: EntityKind[],
  valid: Set<string>,
): ContentProblem[] {
  const owners = new Map<string, Set<string>>();
  for (const e of entities) {
    if (!universe.includes(e.kind)) continue;
    for (const name of [e.names.de, e.names.en, ...e.aliases]) {
      const key = normalize(name);
      if (!key) continue;
      owners.set(key, (owners.get(key) ?? new Set()).add(e.id));
    }
  }
  const problems: ContentProblem[] = [];
  for (const [alias, ids] of owners) {
    if (ids.size < 2) continue;
    const list = [...ids];
    const validCount = list.filter((id) => valid.has(id)).length;
    if (validCount > 0 && validCount < list.length) {
      problems.push({
        level: "warning",
        where: questionId,
        message: `„${alias}“ passt auf gültige und ungültige Antworten: ${list.join(", ")}`,
      });
    }
  }
  return problems;
}
