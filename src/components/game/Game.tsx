"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PlayResponse, QuestionResult, StartQuestionResponse, SummaryResponse } from "@/lib/api/types";
import { api, ApiClientError } from "@/lib/api/client";
import type { Locale } from "@/lib/content/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { localIsoDate } from "@/lib/game/puzzle-date";
import { currentStreak, type History } from "@/lib/game/streak";
import { DialogBox } from "@/components/DialogBox";
import { Pokeball } from "@/components/Pokeball";
import { QuestionView } from "./QuestionView";
import { RevealView } from "./RevealView";
import { SummaryView } from "./SummaryView";

export type GameTexts = Pick<Dictionary, "play" | "summary" | "tiers" | "categories" | "errors">;

type Screen =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "intro" }
  | { kind: "question"; question: StartQuestionResponse; deadline: number }
  | { kind: "reveal"; result: QuestionResult; correctedFrom: string | null; finished: boolean }
  | { kind: "summary"; data: SummaryResponse; streak: number };

const HISTORY_KEY = "pokrillion:history";

/** Remembers finished days for the streak. localStorage may be unavailable – the game works without it. */
function recordFinished(date: string, score: number): number {
  try {
    const history: History = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "{}");
    history[date] = score;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return currentStreak(history, date);
  } catch {
    return 1;
  }
}

export function Game({ lang, t }: { lang: Locale; t: GameTexts }) {
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiClientError ? err.code : "generic";
      const message = code === "no_puzzle" || code === "network" ? t.errors[code] : t.errors.generic;
      setScreen({ kind: "error", message });
    },
    [t],
  );

  const showSummary = useCallback(
    async (p: PlayResponse) => {
      const data = await api.summary(p.playId);
      setScreen({ kind: "summary", data, streak: recordFinished(p.date, data.totalScore) });
    },
    [],
  );

  const onPlay = useCallback(
    async (p: PlayResponse) => {
      setPlay(p);
      if (p.finished) await showSummary(p);
      else setScreen({ kind: "intro" });
    },
    [showSummary],
  );

  /** Starts or resumes today's play (the initial screen already is "loading"). */
  useEffect(() => {
    api.startPlay(localIsoDate(), lang).then(onPlay).catch(fail);
  }, [lang, onPlay, fail]);

  function retry() {
    setScreen({ kind: "loading" });
    api.startPlay(localIsoDate(), lang).then(onPlay).catch(fail);
  }

  const nextPosition = play ? (play.openPosition ?? play.results.length + 1) : 1;

  async function startNext() {
    if (!play) return;
    try {
      const question = await api.startQuestion(play.playId, nextPosition);
      setPlay({ ...play, openPosition: nextPosition });
      setScreen({ kind: "question", question, deadline: Date.now() + question.remainingS * 1000 });
    } catch (err) {
      fail(err);
    }
  }

  const onAnswered = useCallback((result: QuestionResult, correctedFrom: string | null, finished: boolean) => {
    setPlay((p) =>
      p
        ? {
            ...p,
            openPosition: null,
            finished,
            results: [...p.results.filter((r) => r.position !== result.position), result],
            totalScore: p.totalScore + result.points,
          }
        : p,
    );
    setScreen({ kind: "reveal", result, correctedFrom, finished });
  }, []);

  const playId = play?.playId;
  const openPosition = screen.kind === "question" ? screen.question.position : null;
  const guess = useCallback(
    (input: string) => api.guess(playId!, openPosition!, input),
    [playId, openPosition],
  );
  const onExpired = useCallback(() => {
    api
      .timeout(playId!, openPosition!)
      .then((res) => onAnswered(res.result, null, res.finished))
      .catch(fail);
  }, [playId, openPosition, onAnswered, fail]);

  async function next() {
    if (!play) return;
    if (screen.kind === "reveal" && screen.finished) {
      setScreen({ kind: "loading" });
      try {
        await showSummary(play);
      } catch (err) {
        fail(err);
      }
    } else {
      await startNext();
    }
  }

  const total = play?.questionCount ?? 7;
  const current = screen.kind === "reveal" ? screen.result.position : nextPosition;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href={`/${lang}`} aria-label="Pokrillion">
          <Pokeball size={32} />
        </Link>
        {(screen.kind === "question" || screen.kind === "reveal") && (
          <>
            <span className="text-drift">{fill(t.play.question, { current, total })}</span>
            <span className="text-electric">{fill(t.play.points, { points: play?.totalScore ?? 0 })}</span>
          </>
        )}
      </header>

      {screen.kind === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Pokeball size={64} className="animate-wobble" />
          <p className="text-drift">{t.play.loading}</p>
        </div>
      )}

      {screen.kind === "error" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <DialogBox arrow={false}>{screen.message}</DialogBox>
          <button onClick={retry} className="pixel-button bg-ball-red px-6 py-1 font-display text-xl text-moon">
            {t.errors.retry}
          </button>
        </div>
      )}

      {screen.kind === "intro" && play && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <h2 className="font-display text-4xl text-electric">{fill(t.play.introTitle, { number: play.number })}</h2>
          <DialogBox>{t.play.introText}</DialogBox>
          <button
            autoFocus
            onClick={startNext}
            className="pixel-button bg-ball-red px-10 py-2 font-display text-3xl text-moon hover:brightness-110"
          >
            {nextPosition === 1 ? t.play.start : fill(t.play.resume, { n: nextPosition })}
          </button>
        </div>
      )}

      {screen.kind === "question" && play && (
        <QuestionView
          key={screen.question.position}
          question={screen.question}
          initialDeadline={screen.deadline}
          lang={lang}
          t={t}
          guess={guess}
          onAnswered={onAnswered}
          onExpired={onExpired}
          onError={fail}
        />
      )}

      {screen.kind === "reveal" && (
        <RevealView
          key={screen.result.position}
          result={screen.result}
          correctedFrom={screen.correctedFrom}
          isLast={screen.finished}
          lang={lang}
          t={t}
          onNext={next}
        />
      )}

      {screen.kind === "summary" && <SummaryView data={screen.data} streak={screen.streak} lang={lang} t={t} />}
    </div>
  );
}
