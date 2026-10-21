/**
 * Hybrid rarity scoring, see docs/KONZEPT.md §3.
 *
 *   p0(a)    = familiarity(a)^γ / Σ familiarity^γ
 *   share(a) = (n(a) + K·p0(a)) / (N + K)      n, N = answers of *other* players so far
 *   points   = 10 … 85 on a log scale between SHARE_HI and SHARE_LO, 100 for the masterball answer
 */
export const SCORING = {
  /** >1 makes well-known answers dominate the prior. */
  gamma: 3.5,
  /** Weight of the prior, in "virtual players". */
  priorStrength: 30,
  /** At or above this share an answer is worth the minimum. */
  shareHi: 0.25,
  /** At or below this share an answer is worth the maximum. */
  shareLo: 0.002,
  minPoints: 10,
  maxPoints: 85,
  masterballPoints: 100,
  roundTo: 5,
} as const;

/** Prior share per answer from familiarity values (1–100). */
export function priorShares(familiarity: ReadonlyMap<string, number>): Map<string, number> {
  const weights = new Map<string, number>();
  let sum = 0;
  for (const [id, f] of familiarity) {
    const w = Math.pow(Math.max(1, f), SCORING.gamma);
    weights.set(id, w);
    sum += w;
  }
  const shares = new Map<string, number>();
  for (const [id, w] of weights) shares.set(id, sum > 0 ? w / sum : 0);
  return shares;
}

/**
 * Smoothed share of one answer: "how many other players said this?"
 * The guess being scored is *not* counted, otherwise every answer of the first players
 * would have a share of at least 1/(K+1) and rare answers could never score high.
 * @param count how often other players gave this answer today
 * @param total all valid answers of other players to this question today
 */
export function answerShare(priorShare: number, count: number, total: number): number {
  const k = SCORING.priorStrength;
  return (count + k * priorShare) / (total + k);
}

export function pointsForShare(share: number): number {
  const { shareHi, shareLo, minPoints, maxPoints, roundTo } = SCORING;
  const r = Math.log(shareHi / Math.max(share, 1e-9)) / Math.log(shareHi / shareLo);
  const clamped = Math.min(1, Math.max(0, r));
  const raw = minPoints + (maxPoints - minPoints) * clamped;
  return Math.round(raw / roundTo) * roundTo;
}

export interface ScoreInput {
  entityId: string;
  masterballId: string;
  priorShare: number;
  /** answers of other players, see answerShare */
  count: number;
  total: number;
}

export function scoreAnswer({ entityId, masterballId, priorShare, count, total }: ScoreInput): number {
  if (entityId === masterballId) return SCORING.masterballPoints;
  return pointsForShare(answerShare(priorShare, count, total));
}
