"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GuessResponse, QuestionResult, StartQuestionResponse } from "@/lib/api/types";
import { ApiClientError } from "@/lib/api/client";
import type { Locale } from "@/lib/content/schema";
import { fill } from "@/i18n/fill";
import { normalize } from "@/lib/game/normalize";
import { DialogBox } from "@/components/DialogBox";
import type { GameTexts } from "./Game";
import { HOT_SHARE, RadarTimer, hpColor } from "./RadarTimer";
import { TypedText } from "./TypedText";
import { useNow } from "./use-now";

type Feedback = { text: string; tone: "bad" | "neutral" };

/**
 * One question with timer and input. Mode-agnostic: daily and endless mode pass their own
 * `guess` call and handle timeouts in `onExpired` (which must be safe to call twice).
 */
export function QuestionView({
  question,
  initialDeadline,
  lang,
  t,
  guess,
  onAnswered,
  onExpired,
  onError,
}: {
  question: StartQuestionResponse;
  /** epoch ms when the timer hits zero */
  initialDeadline: number;
  lang: Locale;
  t: GameTexts;
  guess: (input: string) => Promise<GuessResponse>;
  /** A valid answer. `correctedFrom` is the raw input when a typo was forgiven. */
  onAnswered: (result: QuestionResult, correctedFrom: string | null, finished: boolean) => void;
  /** The timer ran out (on the client or according to the server). */
  onExpired: () => void;
  onError: (err: unknown) => void;
}) {
  const [deadline, setDeadline] = useState(initialDeadline);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const timedOut = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const now = useNow(100);
  const remaining = now === 0 ? question.remainingS : Math.max(0, (deadline - now) / 1000);
  const expired = now !== 0 && remaining <= 0;
  const share = Math.min(1, remaining / question.timeLimitS);
  const hot = share <= HOT_SHARE && !expired;

  useEffect(() => {
    if (!expired || timedOut.current) return;
    timedOut.current = true;
    onExpired();
  }, [expired, onExpired]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || busy || expired) return;
    setBusy(true);
    try {
      const res = await guess(value);
      switch (res.result) {
        case "valid":
          timedOut.current = true;
          onAnswered(
            { position: question.position, points: res.points, tier: res.tier, entity: res.entity },
            res.corrected ? value : null,
            res.finished,
          );
          return;
        case "timeout":
          timedOut.current = true;
          onExpired();
          return;
        case "wrong_entity": {
          // Typos, the other language's name or aliases resolve to a name the player never typed.
          const name = res.entity.names[lang];
          const text =
            normalize(value) === normalize(name)
              ? fill(t.play.wrongEntity, { name })
              : fill(t.play.wrongEntityAs, { input: value, name });
          setFeedback({ text, tone: "bad" });
          break;
        }
        case "unknown":
          setFeedback({ text: t.play.unknown, tone: "bad" });
          break;
        case "duplicate_wrong":
          setFeedback({ text: t.play.duplicate, tone: "neutral" });
          break;
      }
      setDeadline(Date.now() + res.remainingS * 1000);
      // Animate in place: remounting the input would drop focus (and close the mobile keyboard).
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        rowRef.current?.animate(
          [0, -8, 7, -5, 3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
          { duration: 400 },
        );
      }
      setInput("");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "bad_request") return;
      onError(err);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center py-6">
        <DialogBox label={t.categories[question.category]}>
          <p className="text-[clamp(28px,8vw,40px)] leading-[1.02] [text-shadow:0_0_16px_rgb(232_241_255/0.25),2px_0_rgb(255_77_94/0.18),-2px_0_rgb(77_227_255/0.18)]">
            <TypedText text={question.prompt[lang]} />
          </p>
          <p className="mt-2 text-[13px] tracking-[0.14em] text-drift uppercase">{t.play.hint}</p>
        </DialogBox>
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 -mx-3 bg-linear-to-b from-night-800/0 to-night-950/90 to-25% px-3 pt-6 pb-1"
      >
        <p
          aria-live="polite"
          className={`mb-3 min-h-6 text-center text-base tracking-[0.08em] [text-shadow:0_1px_0_rgb(0_0_0/0.6)] ${
            expired || feedback?.tone === "bad" ? "text-warn" : "text-drift"
          }`}
        >
          {expired ? t.play.timeUp : feedback?.text}
        </p>
        <div ref={rowRef} className="flex items-center gap-2.5">
          <RadarTimer remaining={remaining} total={question.timeLimitS} label={t.play.time} />
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={100}
              disabled={expired}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="send"
              aria-label={t.play.placeholder}
              placeholder={t.play.placeholder}
              className={`w-full border-2 bg-night-800/90 px-2.5 pt-2.5 pb-2 text-[22px] tracking-[0.04em] text-moon caret-ball-red transition-colors duration-200 placeholder:text-drift/55 focus-visible:outline-none ${
                hot ? "border-ball-red" : "border-line focus:border-moonlight/65"
              }`}
            />
            {/* fuse: the time left as a thin HP bar under the input */}
            <div className="absolute -bottom-2 left-0 h-1 w-full overflow-hidden bg-[#0a1322] shadow-[0_0_0_2px_var(--color-ink)]">
              <div
                className="h-full w-full origin-left transition-[transform,background-color] duration-100 ease-linear"
                style={{ transform: `scaleX(${share})`, backgroundColor: hpColor(share) }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || expired || !input.trim()}
            className="btn-primary flex-none px-4 pt-2.5 pb-2 text-[21px]"
          >
            {t.play.submit}
          </button>
        </div>
      </form>

      {hot && (
        <div
          aria-hidden
          className="animate-throb pointer-events-none fixed inset-0 z-20 shadow-[inset_0_0_90px_18px_rgb(255_77_94/0.6)]"
        />
      )}
    </div>
  );
}
