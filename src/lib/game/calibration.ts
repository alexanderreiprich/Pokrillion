import { SCORING } from "./scoring";

/** Below this many answers to a question, observed shares are too noisy to suggest anything. */
export const MIN_ANSWERS_FOR_CALIBRATION = 30;

/**
 * Familiarity that would make the prior match what players actually answer.
 * Prior weight is familiarity^γ, so a share that is k times the prior needs familiarity × k^(1/γ).
 * Only meaningful relative to the other answers of the same question – it is a hint, not a rule.
 * Pass the *smoothed* share (answerShare), so small samples only nudge the value.
 */
export function suggestFamiliarity(familiarity: number, priorShare: number, smoothedShare: number): number {
  if (priorShare <= 0) return familiarity;
  const ratio = Math.max(smoothedShare, 1e-6) / priorShare;
  const suggested = familiarity * Math.pow(ratio, 1 / SCORING.gamma);
  return Math.max(1, Math.min(100, Math.round(suggested / 5) * 5));
}
