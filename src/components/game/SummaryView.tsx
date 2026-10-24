"use client";

import { useState } from "react";
import Link from "next/link";
import type { AnswerStat, SummaryResponse } from "@/lib/api/types";
import type { Locale } from "@/lib/content/schema";
import { fill } from "@/i18n/fill";
import { QUESTIONS_PER_PUZZLE } from "@/lib/game/puzzle-date";
import { SCORING } from "@/lib/game/scoring";
import { buildShareText } from "@/lib/game/share";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";
import type { GameTexts } from "./Game";
import { useNow } from "./use-now";

const MAX_SCORE = QUESTIONS_PER_PUZZLE * SCORING.masterballPoints;

function formatPct(pct: number, lang: Locale): string {
  const digits = pct > 0 && pct < 1 ? 1 : 0;
  return pct.toLocaleString(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function untilMidnight(now: number): string {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const s = Math.max(0, Math.floor((midnight - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function SummaryView({
  data,
  streak,
  lang,
  t,
}: {
  data: SummaryResponse;
  streak: number;
  lang: Locale;
  t: GameTexts;
}) {
  const [copied, setCopied] = useState(false);
  const now = useNow(1000);

  async function share() {
    const text = buildShareText({
      number: data.number,
      points: data.questions.map((q) => (q.yours.entity ? q.yours.points : null)),
    });
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // share sheet dismissed / clipboard blocked: nothing to do
    }
  }

  const statLine = (s: AnswerStat) => (
    <li key={s.entity.id} className="flex justify-between gap-2">
      <span className="truncate">{s.entity.names[lang]}</span>
      <span className="shrink-0 text-drift tabular-nums">{formatPct(s.pct, lang)} %</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-10 pt-14 pb-24">
      <section className="animate-card-in flex flex-col items-center gap-2 text-center">
        <p className="chroma-sm text-[27px] leading-none tracking-[0.06em] uppercase">Pokrillion #{data.number}</p>
        <p className="text-sm tracking-[0.3em] text-drift uppercase">{t.summary.title}</p>
        <p className="glow mt-2 text-[96px] leading-[0.8] text-ball-red tabular-nums">{data.totalScore}</p>
        <p className="text-base tracking-[0.14em] text-drift uppercase">
          {fill(t.summary.total, { score: data.totalScore, max: MAX_SCORE })}
        </p>

        {/* EXP bar */}
        <div className="mt-2 flex w-full max-w-sm items-center gap-2" aria-hidden>
          <span className="text-sm tracking-[0.2em] text-moonlight">{t.summary.exp}</span>
          <div className="h-2 flex-1 overflow-hidden bg-[#0a1322] shadow-[0_0_0_2px_var(--color-ink),0_0_0_4px_var(--color-line)]">
            <div
              className="h-full bg-moonlight shadow-[0_0_10px_var(--color-moonlight)]"
              style={{ width: `${(100 * data.totalScore) / MAX_SCORE}%` }}
            />
          </div>
        </div>

        <div className="mt-2 flex gap-1.5" aria-hidden>
          {data.questions.map((q) => (
            <span key={q.position} style={{ filter: `drop-shadow(0 0 6px ${TIER_COLOR[q.yours.tier]})` }}>
              <Pokeball size={28} color={TIER_COLOR[q.yours.tier]} />
            </span>
          ))}
        </div>

        <button onClick={share} className="btn-primary mt-4 px-6 pt-3 pb-2.5 text-[19px]">
          {copied ? t.summary.copied : t.summary.share}
        </button>
        <p className="mt-2 text-sm tracking-[0.14em] text-drift uppercase">
          {streak > 0 && (
            <>
              {fill(t.summary.streak, { n: streak, days: streak === 1 ? t.summary.day : t.summary.days })}
              {" · "}
            </>
          )}
          {now > 0 && fill(t.summary.nextIn, { time: untilMidnight(now) })}
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <p className="fathom">{t.summary.catches}</p>
        <ol className="flex flex-col gap-6">
          {data.questions.map((q) => {
            const color = TIER_COLOR[q.yours.tier];
            return (
              <li key={q.position} className="pod p-4">
                <p className="text-sm tracking-[0.2em] text-drift uppercase">
                  <span className="text-ball-red">{String(q.position).padStart(2, "0")}</span> ·{" "}
                  {t.categories[q.category]} · {fill(t.summary.possible, { n: q.answerCount })}
                </p>
                <p className="mt-1 mb-3 text-2xl leading-tight">{q.prompt[lang]}</p>

                <div className="mb-3 flex items-center gap-3">
                  <span style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
                    <Pokeball size={28} color={color} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{q.yours.entity ? q.yours.entity.names[lang] : t.summary.noAnswer}</p>
                    <p className="text-base tracking-[0.08em] text-drift">
                      <span className="uppercase" style={{ color }}>
                        {t.tiers[q.yours.tier]}
                      </span>
                      {q.yours.pct !== null && <> · {fill(t.summary.ofPlayers, { pct: formatPct(q.yours.pct, lang) })}</>}
                    </p>
                  </div>
                  <span className="glow text-3xl tabular-nums" style={{ color }}>
                    +{q.yours.points}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-dashed border-line pt-3 text-lg sm:grid-cols-2">
                  <div>
                    <p className="text-sm tracking-[0.14em] text-drift uppercase">
                      {t.summary.top} ({fill(q.players === 1 ? t.summary.player : t.summary.players, { n: q.players })})
                    </p>
                    <ul>{q.top.map(statLine)}</ul>
                  </div>
                  <div>
                    <p className="text-sm tracking-[0.14em] uppercase" style={{ color: TIER_COLOR.masterball }}>
                      {t.summary.masterball}
                    </p>
                    <ul>{statLine(q.masterball)}</ul>
                  </div>
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
  );
}
