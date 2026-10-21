"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { GuessResponse, QuestionResult, StartQuestionResponse } from "@/lib/api/types";
import { ApiClientError } from "@/lib/api/client";
import type { Locale } from "@/lib/content/schema";
import { fill } from "@/i18n/fill";
import { normalize } from "@/lib/game/normalize";
import { DialogBox } from "@/components/DialogBox";
import { HpBar } from "@/components/HpBar";
import type { GameTexts } from "./Game";
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
          [0, -6, 6, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px)` })),
          { duration: 300 },
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
    <div className="flex flex-col gap-5">
      <HpBar value={remaining / question.timeLimitS} label={t.play.time} />

      <div className="flex flex-col gap-2">
        <span className="text-lg text-drift">{t.categories[question.category]}</span>
        <DialogBox>
          <TypedText text={question.prompt[lang]} />
        </DialogBox>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div ref={rowRef} className="flex gap-2">
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
            className="min-w-0 flex-1 rounded-sm border-2 border-line bg-night-900 px-3 py-2 text-2xl text-moon placeholder:text-drift/60 focus:border-moonlight focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || expired || !input.trim()}
            className="pixel-button bg-ball-red px-4 font-display text-xl text-moon disabled:opacity-60"
          >
            {t.play.submit}
          </button>
        </div>
        <p
          aria-live="polite"
          className={`min-h-7 text-xl ${feedback?.tone === "bad" ? "text-hp-low" : "text-drift"}`}
        >
          {expired ? t.play.timeUp : feedback?.text}
        </p>
      </form>
    </div>
  );
}
