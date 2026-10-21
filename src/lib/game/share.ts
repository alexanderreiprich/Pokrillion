import { QUESTIONS_PER_PUZZLE } from "./puzzle-date";
import { SCORING } from "./scoring";
import { tierForPoints } from "./tiers";

export interface ShareInput {
  number: number;
  /** Points per question in order; `null` for unanswered/timed out. */
  points: (number | null)[];
  url?: string;
}

/**
 * Pokrillion #42 · 412/700
 * 🔴🔵✨💨🟡🟣🔵
 * pokrillion.io
 */
export function buildShareText({ number, points, url = "pokrillion.io" }: ShareInput): string {
  const total = points.reduce<number>((sum, p) => sum + (p ?? 0), 0);
  const max = QUESTIONS_PER_PUZZLE * SCORING.masterballPoints;
  const row = points.map((p) => tierForPoints(p ?? 0).emoji).join("");
  return `Pokrillion #${number} · ${total}/${max}\n${row}\n${url}`;
}
