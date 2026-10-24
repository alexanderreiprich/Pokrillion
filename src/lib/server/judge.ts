import "server-only";
import { evaluateGuess, type GuessOutcome } from "@/lib/game/guess";
import { normalize } from "@/lib/game/normalize";
import { answerPriors, universeIndex } from "./content";
import { ApiError } from "./http";

const MAX_INPUT_LENGTH = 100;

export interface Judgement {
  input: string;
  normalized: string;
  outcome: GuessOutcome;
  /** valid answers → prior share */
  priors: Map<string, number>;
}

/** Cleans the raw input and classifies it against a question. Shared by daily and endless mode. */
export async function judge(question: { id: string; universe: string[] }, rawInput: string): Promise<Judgement> {
  const input = rawInput.trim().slice(0, MAX_INPUT_LENGTH);
  const normalized = normalize(input);
  if (!normalized) throw new ApiError("bad_request", "Leere Eingabe");
  const [index, priors] = await Promise.all([universeIndex(question.universe), answerPriors(question.id)]);
  return { input, normalized, outcome: evaluateGuess(index, new Set(priors.keys()), input), priors };
}
