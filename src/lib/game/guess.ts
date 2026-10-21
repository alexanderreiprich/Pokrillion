import { matchInput, type MatchIndex } from "./match";

export type GuessOutcome =
  | { result: "valid"; entityId: string; corrected: boolean }
  | { result: "wrong_entity"; entityId: string }
  | { result: "unknown" };

/**
 * Classifies one guess against a question.
 * Exact ties (two entities with the same name) resolve to a valid one if any is valid.
 * Fuzzy ties are never resolved: guessing which one the player meant would be unfair either way.
 */
export function evaluateGuess(index: MatchIndex, validIds: ReadonlySet<string>, input: string): GuessOutcome {
  const match = matchInput(index, input);
  switch (match.type) {
    case "none":
      return { result: "unknown" };
    case "exact":
    case "fuzzy":
      return validIds.has(match.entityId)
        ? { result: "valid", entityId: match.entityId, corrected: match.type === "fuzzy" }
        : { result: "wrong_entity", entityId: match.entityId };
    case "ambiguous": {
      if (match.distance > 0) return { result: "unknown" };
      const valid = match.candidates.filter((id) => validIds.has(id)).sort();
      if (valid.length > 0) return { result: "valid", entityId: valid[0], corrected: false };
      return { result: "wrong_entity", entityId: match.candidates[0] };
    }
  }
}
