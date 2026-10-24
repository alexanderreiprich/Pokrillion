import { normalize } from "./normalize";

export interface MatchableEntity {
  id: string;
  names: { de: string; en: string };
  aliases?: string[];
}

export interface MatchIndex {
  /** normalized alias → entity ids carrying that alias */
  byAlias: Map<string, Set<string>>;
}

export type MatchResult =
  | { type: "exact" | "fuzzy"; entityId: string; distance: number }
  | { type: "ambiguous"; candidates: string[]; distance: number }
  | { type: "none" };

/**
 * Builds the lookup over the whole *universe* of a question (e.g. all Pokémon), not just the
 * valid answers. Otherwise a real but wrong answer would be fuzzy-corrected into a valid one
 * ("Golbat" → "Golbit" on a ghost-type question).
 */
export function buildIndex(entities: Iterable<MatchableEntity>): MatchIndex {
  const byAlias = new Map<string, Set<string>>();
  for (const e of entities) {
    for (const raw of [e.names.de, e.names.en, ...(e.aliases ?? [])]) {
      const alias = normalize(raw);
      if (!alias) continue;
      const ids = byAlias.get(alias) ?? new Set<string>();
      ids.add(e.id);
      byAlias.set(alias, ids);
    }
  }
  return { byAlias };
}

/** Same index from already-normalized alias rows (the `entity_aliases` table). */
export function indexFromAliases(rows: Iterable<{ alias: string; entity_id: string }>): MatchIndex {
  const byAlias = new Map<string, Set<string>>();
  for (const { alias, entity_id } of rows) {
    const ids = byAlias.get(alias) ?? new Set<string>();
    ids.add(entity_id);
    byAlias.set(alias, ids);
  }
  return { byAlias };
}

/** Typos allowed for an input of this (normalized) length. */
export function maxDistance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

export function matchInput(index: MatchIndex, input: string): MatchResult {
  const needle = normalize(input);
  if (!needle) return { type: "none" };

  const exact = index.byAlias.get(needle);
  if (exact) {
    const ids = [...exact];
    return ids.length === 1
      ? { type: "exact", entityId: ids[0], distance: 0 }
      : { type: "ambiguous", candidates: ids, distance: 0 };
  }

  const limit = maxDistance(needle.length);
  if (limit === 0) return { type: "none" };

  // `best` is the largest distance still accepted; osaDistance returns best + 1 for anything worse.
  let best = limit;
  let candidates = new Set<string>();
  for (const [alias, ids] of index.byAlias) {
    const d = osaDistance(needle, alias, best + 1);
    if (d > best) continue;
    if (d < best || candidates.size === 0) {
      best = d;
      candidates = new Set(ids);
    } else {
      ids.forEach((id) => candidates.add(id));
    }
  }

  if (candidates.size === 0) return { type: "none" };
  const ids = [...candidates];
  return ids.length === 1
    ? { type: "fuzzy", entityId: ids[0], distance: best }
    : { type: "ambiguous", candidates: ids, distance: best };
}

/**
 * Optimal-string-alignment distance (Levenshtein + adjacent transpositions).
 * Returns `cutoff` as soon as the result is known to be ≥ cutoff.
 */
export function osaDistance(a: string, b: string, cutoff = Infinity): number {
  if (Math.abs(a.length - b.length) >= cutoff) return cutoff;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev2 = new Array<number>(cols).fill(0);
  let prev = Array.from({ length: cols }, (_, j) => j);
  let cur = new Array<number>(cols).fill(0);

  for (let i = 1; i < rows; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin >= cutoff) return cutoff;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return Math.min(prev[cols - 1], cutoff);
}

/**
 * Closest entities for an input that matched nothing – for curation ("probably meant …").
 * Unlike matchInput this ignores the length-based typo limit and returns several candidates.
 */
export function closestEntities(
  index: MatchIndex,
  input: string,
  maxDistance = 3,
  limit = 3,
): { entityId: string; distance: number }[] {
  const needle = normalize(input);
  if (!needle) return [];
  const best = new Map<string, number>();
  for (const [alias, ids] of index.byAlias) {
    const d = osaDistance(needle, alias, maxDistance + 1);
    if (d > maxDistance) continue;
    for (const id of ids) if (!best.has(id) || d < best.get(id)!) best.set(id, d);
  }
  return [...best.entries()]
    .map(([entityId, distance]) => ({ entityId, distance }))
    .sort((a, b) => a.distance - b.distance || a.entityId.localeCompare(b.entityId))
    .slice(0, limit);
}
