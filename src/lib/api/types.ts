import type { QuestionCategory } from "@/lib/content/schema";
import type { TierId } from "@/lib/game/tiers";

/** JSON contract of /api/v1, shared by route handlers and the game UI. See docs/KONZEPT.md §7. */

export type Names = { de: string; en: string };
export type EntityRef = { id: string; names: Names };

export interface QuestionResult {
  position: number;
  points: number;
  tier: TierId;
  /** null when the question timed out */
  entity: EntityRef | null;
}

export interface PlayResponse {
  playId: string;
  date: string;
  number: number;
  questionCount: number;
  /** Answered questions in order. */
  results: QuestionResult[];
  /** A question that was started but not answered yet (resume after reload). */
  openPosition: number | null;
  finished: boolean;
  totalScore: number;
}

export interface StartQuestionResponse {
  position: number;
  category: QuestionCategory;
  prompt: Names;
  timeLimitS: number;
  remainingS: number;
}

export type GuessResponse =
  | { result: "valid"; entity: EntityRef; points: number; tier: TierId; corrected: boolean; finished: boolean }
  | { result: "wrong_entity"; entity: EntityRef; remainingS: number }
  | { result: "unknown"; remainingS: number }
  | { result: "duplicate_wrong"; remainingS: number }
  | { result: "timeout"; finished: boolean };

export interface TimeoutResponse {
  result: QuestionResult;
  finished: boolean;
}

export interface AnswerStat {
  entity: EntityRef;
  /** share of players who finished this question, 0–100 */
  pct: number;
}

export interface SummaryQuestion {
  position: number;
  category: QuestionCategory;
  prompt: Names;
  yours: QuestionResult & { pct: number | null };
  players: number;
  top: AnswerStat[];
  masterball: AnswerStat;
  answerCount: number;
}

export interface SummaryResponse {
  date: string;
  number: number;
  totalScore: number;
  questions: SummaryQuestion[];
}

export type ApiErrorCode =
  | "bad_request"
  | "invalid_date"
  | "no_puzzle"
  | "not_found"
  | "out_of_order"
  | "not_started"
  | "already_answered"
  | "unfinished"
  | "unauthorized"
  | "internal";

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}
