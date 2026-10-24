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
import { Boot, BootError } from "./Boot";
import type { GameTexts } from "./Game";
import { Hud, HudLabel } from "./Hud";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
      {inRun && run && (
        <Hud score={run.score} scoreLabel={t.play.score}>
          <span className="flex gap-1.5" role="img" aria-label={fill(t.endless.ballsLeft, { n: run.lives })}>
            {Array.from({ length: run.maxLives }, (_, i) => (
              <span key={i} className={i < run.lives ? "drop-shadow-[0_0_5px_rgb(255_77_94/0.7)]" : "opacity-25 grayscale"}>
                <Pokeball size={16} />
              </span>
            ))}
          </span>
          <HudLabel>{fill(t.endless.question, { n: current })}</HudLabel>
        </Hud>
      )}

      {screen.kind === "loading" && <Boot label={t.play.loading} />}

      {screen.kind === "error" && (
        <BootError message={screen.message}>
          <Link href={`/${lang}`} className="btn-quiet px-5 pt-2.5 pb-2 text-base">
            {t.summary.home}
          </Link>
        </BootError>
      )}

      {screen.kind === "intro" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 text-center">
          <h1 className="chroma animate-flicker text-[clamp(40px,12vw,72px)] leading-none tracking-[0.04em] uppercase">
            ∞ {t.endless.title}
          </h1>
          <DialogBox className="w-full text-left text-2xl leading-tight">{t.endless.intro}</DialogBox>
          <div className="flex flex-col items-center gap-7">
            {run && !run.ended && (
              <button
                autoFocus
                onClick={() => {
                  setScreen({ kind: "loading" });
                  nextQuestion(run.runId);
                }}
                className="btn-ring animate-bob px-10 pt-3.5 pb-3 text-[clamp(22px,6vw,28px)] [animation-duration:1.9s]"
              >
                {t.endless.resume}
              </button>
            )}
            <button
              autoFocus={!run || run.ended}
              onClick={startNew}
              className={
                run && !run.ended
                  ? "btn-quiet px-5 pt-2.5 pb-2 text-base"
                  : "btn-ring animate-bob px-10 pt-3.5 pb-3 text-[clamp(22px,6vw,28px)] [animation-duration:1.9s]"
              }
            >
              {run && !run.ended ? t.endless.newRun : t.endless.start}
            </button>
          </div>
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
        <div className="flex flex-col gap-10 pt-14 pb-24">
          <section className="animate-card-in flex flex-col items-center gap-2 text-center">
            <p className="chroma-sm text-[27px] leading-none tracking-[0.06em] uppercase">
              {screen.exhausted ? t.endless.exhausted : t.endless.title}
            </p>
            {!screen.exhausted && <p className="text-sm tracking-[0.3em] text-drift uppercase">{t.endless.over}</p>}
            <p className="glow mt-2 text-[96px] leading-[0.8] text-ball-red tabular-nums">{screen.run.score}</p>
            <p className="text-base tracking-[0.14em] text-drift uppercase">
              {fill(t.endless.summary, { score: screen.run.score, n: screen.run.results.length })}
            </p>
            <p
              className={
                screen.newBest
                  ? "glow text-xl tracking-[0.2em] text-tier-shiny uppercase"
                  : "text-base tracking-[0.14em] text-drift uppercase"
              }
            >
              {screen.newBest ? t.endless.newBest : fill(t.endless.best, { best: screen.best })}
            </p>
            <button autoFocus onClick={startNew} className="btn-primary mt-4 px-6 pt-3 pb-2.5 text-[19px]">
              {t.endless.again}
            </button>
          </section>

          <section className="flex flex-col gap-5">
            <p className="fathom">{t.summary.catches}</p>
            <ol className="flex flex-col gap-5">
              {screen.run.results.map((r) => {
                const color = TIER_COLOR[r.tier];
                return (
                  <li key={r.position} className="pod p-3">
                    <p className="text-sm tracking-[0.2em] text-drift uppercase">
                      <span className="text-ball-red">{String(r.position).padStart(2, "0")}</span> ·{" "}
                      {t.categories[r.category]}
                    </p>
                    <p className="mt-1 mb-2 text-xl leading-tight">{r.prompt[lang]}</p>
                    <div className="flex items-center gap-3">
                      <span style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
                        <Pokeball size={24} color={color} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{r.entity ? r.entity.names[lang] : t.summary.noAnswer}</p>
                        <p className="text-base text-drift">
                          <span className="tracking-[0.08em] uppercase" style={{ color: TIER_COLOR.masterball }}>
                            {t.endless.masterball}:
                          </span>{" "}
                          {r.masterball.names[lang]}
                        </p>
                      </div>
                      <span className="glow text-3xl tabular-nums" style={{ color }}>
                        +{r.points}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <Link href={`/${lang}`} className="btn-quiet self-center px-5 pt-2.5 pb-2 text-base">
            {t.summary.home}
          </Link>
        </div>
      )}
    </main>
  );
}
