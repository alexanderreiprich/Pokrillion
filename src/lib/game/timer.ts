/** Seconds deducted for a wrong (non-duplicate) guess. */
export const WRONG_GUESS_PENALTY_S = 3;

/** Network slack: guesses up to this many seconds after the timer ran out still count. */
export const TIMER_GRACE_S = 2;

export interface TimerState {
  startedAt: Date;
  timeLimitS: number;
  penaltyS: number;
}

/** Seconds left on a question (may be negative once expired). */
export function remainingSeconds({ startedAt, timeLimitS, penaltyS }: TimerState, now: Date = new Date()): number {
  const elapsed = (now.getTime() - startedAt.getTime()) / 1000;
  return timeLimitS - penaltyS - elapsed;
}

/** True once the timer is past zero *and* the grace period. */
export function isExpired(timer: TimerState, now: Date = new Date()): boolean {
  return remainingSeconds(timer, now) < -TIMER_GRACE_S;
}
