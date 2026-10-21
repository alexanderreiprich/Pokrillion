"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EndlessRunResponse, QuestionResult, StartQuestionResponse } from "@/lib/api/types";
import { api, ApiClientError } from "@/lib/api/client";
import type { Locale } from "@/lib/content/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { DialogBox } from "@/components/DialogBox";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";
import type { GameTexts } from "./Game";
import { QuestionView } from "./QuestionView";
import { RevealView } from "./RevealView";

export type EndlessTexts = GameTexts & Pick<Dictionary, "endless">;

type Screen =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "intro" }
  | { kind: "question"; question: StartQuestionResponse; deadline: number }
  | { kind: "reveal"; result: QuestionResult; correctedFrom: string | null; note?: string; finished: boolean }
  | { kind: "over"; run: EndlessRunResponse; best: number; newBest: boolean; exhausted: boolean };

const BEST_KEY = "pokrillion:endless-best";

/** Stores the best score per browser. localStorage may be unavailable – then there is no record. */
function recordBest(score: number): { best: number; newBest: boolean } {
  try {
    const previous = Number(localStorage.getItem(BEST_KEY) ?? 0);
    if (score > previous) {
      localStorage.setItem(BEST_KEY, String(score));
      return { best: score, newBest: score > 0 };
    }
    return { best: previous, newBest: false };
  } catch {
    return { best: score, newBest: false };
  }
}

export function Endless({ lang, t }: { lang: Locale; t: EndlessTexts }) {
  const [run, setRun] = useState<EndlessRunResponse | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiClientError ? err.code : "generic";
      setScreen({ kind: "error", message: code === "network" ? t.errors.network : t.errors.generic });
    },
    [t],
  );

  // An open run from earlier (reload, closed tab) can be continued.
  useEffect(() => {
    api
      .endlessCurrent()
      .then((r) => {
        setRun(r);
        setScreen({ kind: "intro" });
      })
      .catch(fail);
  }, [fail]);

  const showOver = useCallback(
    async (runId: string, exhausted = false) => {
      const final = await api.endlessRun(runId);
      setRun(final);
      setScreen({ kind: "over", run: final, exhausted, ...recordBest(final.score) });
    },
    [],
  );

  const nextQuestion = useCallback(
    async (runId: string) => {
      try {
        const question = await api.endlessNext(runId);
        setScreen({ kind: "question", question, deadline: Date.now() + question.remainingS * 1000 });
      } catch (err) {
        if (err instanceof ApiClientError && (err.code === "exhausted" || err.code === "ended")) {
          await showOver(runId, err.code === "exhausted").catch(fail);
        } else fail(err);
      }
    },
    [showOver, fail],
  );

  async function startNew() {
    setScreen({ kind: "loading" });
    try {
      const r = await api.endlessStart(lang);
      setRun(r);
      await nextQuestion(r.runId);
    } catch (err) {
      fail(err);
    }
  }

  const runId = run?.runId;
  const seq = screen.kind === "question" ? screen.question.position : null;

  const guess = useCallback((input: string) => api.endlessGuess(runId!, seq!, input), [runId, seq]);

  const onAnswered = useCallback((result: QuestionResult, correctedFrom: string | null) => {
    setRun((r) => (r ? { ...r, score: r.score + result.points } : r));
    setScreen({ kind: "reveal", result, correctedFrom, finished: false });
  }, []);

  const onExpired = useCallback(() => {
    api
      .endlessTimeout(runId!, seq!)
      .then((res) => {
        setRun((r) => (r ? { ...r, lives: res.lives, ended: res.finished } : r));
        const note =
          res.lives === 0 ? t.endless.noBalls : res.lives === 1 ? t.endless.lastBall : fill(t.endless.ballsLeft, { n: res.lives });
        setScreen({ kind: "reveal", result: res.result, correctedFrom: null, note, finished: res.finished });
      })
      .catch(fail);
  }, [runId, seq, t, fail]);

  async function next() {
    if (!runId) return;
    if (screen.kind === "reveal" && screen.finished) {
      setScreen({ kind: "loading" });
      await showOver(runId).catch(fail);
    } else {
      await nextQuestion(runId);
    }
  }

  const inRun = screen.kind === "question" || screen.kind === "reveal";
  const current = screen.kind === "question" ? screen.question.position : screen.kind === "reveal" ? screen.result.position : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href={`/${lang}`} aria-label="Pokrillion">
          <Pokeball size={32} />
        </Link>
        {inRun && run && (
          <>
            <span className="text-drift">{fill(t.endless.question, { n: current })}</span>
            <span className="flex items-center gap-3">
              <span className="flex gap-0.5" aria-label={fill(t.endless.ballsLeft, { n: run.lives })}>
                {Array.from({ length: run.maxLives }, (_, i) => (
                  <Pokeball key={i} size={18} className={i < run.lives ? undefined : "opacity-25 grayscale"} />
                ))}
              </span>
              <span className="text-electric">{fill(t.play.points, { points: run.score })}</span>
            </span>
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
          <Link href={`/${lang}`} className="text-moonlight hover:underline">
            {t.summary.home}
          </Link>
        </div>
      )}

      {screen.kind === "intro" && (
        <div className="flex flex-col items-center gap-6 py-6 text-center">
          <h2 className="font-display text-4xl text-electric">{t.endless.title}</h2>
          <DialogBox>{t.endless.intro}</DialogBox>
          {run && !run.ended && (
            <button
              autoFocus
              onClick={() => {
                setScreen({ kind: "loading" });
                nextQuestion(run.runId);
              }}
              className="pixel-button bg-ball-red px-10 py-2 font-display text-3xl text-moon hover:brightness-110"
            >
              {t.endless.resume}
            </button>
          )}
          <button
            autoFocus={!run || run.ended}
            onClick={startNew}
            className={
              run && !run.ended
                ? "text-xl text-moonlight hover:underline"
                : "pixel-button bg-ball-red px-10 py-2 font-display text-3xl text-moon hover:brightness-110"
            }
          >
            {run && !run.ended ? t.endless.newRun : t.endless.start}
          </button>
        </div>
      )}

      {screen.kind === "question" && (
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
          note={screen.note}
          isLast={screen.finished}
          lang={lang}
          t={t}
          onNext={next}
        />
      )}

      {screen.kind === "over" && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-display text-2xl text-drift">
              {screen.exhausted ? t.endless.exhausted : `${t.endless.title} · ${t.endless.over}`}
            </h2>
            <p className="text-7xl leading-none text-electric">{screen.run.score}</p>
            <p className="text-drift">
              {fill(t.endless.summary, { score: screen.run.score, n: screen.run.results.length })}
            </p>
            <p className={screen.newBest ? "font-display text-xl text-tier-shiny" : "text-drift"}>
              {screen.newBest ? t.endless.newBest : fill(t.endless.best, { best: screen.best })}
            </p>
            <button
              autoFocus
              onClick={startNew}
              className="pixel-button mt-2 bg-ball-red px-8 py-1.5 font-display text-2xl text-moon hover:brightness-110"
            >
              {t.endless.again}
            </button>
          </section>

          <ol className="flex flex-col gap-3">
            {screen.run.results.map((r) => (
              <li key={r.position} className="rounded-md border-2 border-line bg-night-900/80 p-3">
                <p className="text-lg text-drift">
                  {r.position}. {t.categories[r.category]}
                </p>
                <p className="mb-2 text-xl leading-tight">{r.prompt[lang]}</p>
                <div className="flex items-center gap-3">
                  <Pokeball size={24} color={TIER_COLOR[r.tier]} />
                  <div className="flex-1">
                    <p>{r.entity ? r.entity.names[lang] : t.summary.noAnswer}</p>
                    <p className="text-lg text-drift">
                      <span style={{ color: TIER_COLOR.masterball }}>{t.endless.masterball}:</span>{" "}
                      {r.masterball.names[lang]}
                    </p>
                  </div>
                  <span className="text-3xl text-electric">+{r.points}</span>
                </div>
              </li>
            ))}
          </ol>

          <Link href={`/${lang}`} className="text-center text-moonlight hover:underline">
            {t.summary.home}
          </Link>
        </div>
      )}
    </div>
  );
}
