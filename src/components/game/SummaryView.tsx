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
      <span className="shrink-0 text-drift">{formatPct(s.pct, lang)} %</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-display text-2xl text-drift">
          Pokrillion #{data.number} · {t.summary.title}
        </h2>
        <p className="text-7xl leading-none text-electric">{data.totalScore}</p>
        <p className="text-drift">{fill(t.summary.total, { score: data.totalScore, max: MAX_SCORE })}</p>
        <div className="h-3 w-full rounded-sm border-2 border-night-950 bg-night-800 p-px" aria-hidden>
          <div
            className="h-full rounded-[1px] bg-moonlight"
            style={{ width: `${(100 * data.totalScore) / MAX_SCORE}%` }}
          />
        </div>
        <div className="mt-1 flex text-2xl" aria-hidden>
          {data.questions.map((q) => (
            <Pokeball key={q.position} size={28} color={TIER_COLOR[q.yours.tier]} className="mx-0.5" />
          ))}
        </div>
        <button
          onClick={share}
          className="pixel-button mt-2 bg-ball-red px-8 py-1.5 font-display text-2xl text-moon hover:brightness-110"
        >
          {copied ? t.summary.copied : t.summary.share}
        </button>
        <p className="text-drift">
          {streak > 0 && (
            <>
              {fill(t.summary.streak, { n: streak, days: streak === 1 ? t.summary.day : t.summary.days })}
              {" · "}
            </>
          )}
          {now > 0 && fill(t.summary.nextIn, { time: untilMidnight(now) })}
        </p>
      </section>

      <ol className="flex flex-col gap-4">
        {data.questions.map((q) => (
          <li key={q.position} className="rounded-md border-2 border-line bg-night-900/80 p-4">
            <p className="text-lg text-drift">
              {q.position}. {t.categories[q.category]} · {fill(t.summary.possible, { n: q.answerCount })}
            </p>
            <p className="mb-3 text-2xl leading-tight">{q.prompt[lang]}</p>

            <div className="mb-3 flex items-center gap-3">
              <Pokeball size={28} color={TIER_COLOR[q.yours.tier]} />
              <div className="flex-1">
                <p>{q.yours.entity ? q.yours.entity.names[lang] : t.summary.noAnswer}</p>
                <p className="text-lg text-drift">
                  <span style={{ color: TIER_COLOR[q.yours.tier] }}>{t.tiers[q.yours.tier]}</span>
                  {q.yours.pct !== null && <> · {fill(t.summary.ofPlayers, { pct: formatPct(q.yours.pct, lang) })}</>}
                </p>
              </div>
              <span className="text-3xl text-electric">+{q.yours.points}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-lg sm:grid-cols-2">
              <div>
                <p className="text-drift">
                  {t.summary.top} ({fill(q.players === 1 ? t.summary.player : t.summary.players, { n: q.players })})
                </p>
                <ul>{q.top.map(statLine)}</ul>
              </div>
              <div>
                <p style={{ color: TIER_COLOR.masterball }}>{t.summary.masterball}</p>
                <ul>{statLine(q.masterball)}</ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Link href={`/${lang}`} className="text-center text-moonlight hover:underline">
        {t.summary.home}
      </Link>
    </div>
  );
}
