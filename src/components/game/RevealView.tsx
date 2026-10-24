"use client";

import { useEffect, useState } from "react";
import type { QuestionResult } from "@/lib/api/types";
import type { Locale } from "@/lib/content/schema";
import { fill } from "@/i18n/fill";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";
import type { GameTexts } from "./Game";
import { CatchLadder } from "./CatchLadder";

const WOBBLE_MS = 1200;

/** Ball wobbles, then: "Gotcha! · MASTER BALL · Lunatone · +100 pts" (or "It got away!"). */
export function RevealView({
  result,
  correctedFrom,
  note,
  isLast,
  lang,
  t,
  onNext,
}: {
  result: QuestionResult;
  correctedFrom: string | null;
  /** Extra line under the result, e.g. "2 balls left" in endless mode. */
  note?: string;
  isLast: boolean;
  lang: Locale;
  t: GameTexts;
  onNext: () => void;
}) {
  const [settled, setSettled] = useState(false);
  const caught = result.entity !== null;
  const color = TIER_COLOR[result.tier];

  useEffect(() => {
    const id = setTimeout(() => setSettled(true), caught ? WOBBLE_MS : 300);
    return () => clearTimeout(id);
  }, [caught]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
        <span className={settled && result.tier === "masterball" ? "animate-sparkle" : undefined}>
          <span
            className={`block ${caught ? "animate-wobble" : "opacity-60"}`}
            style={{ filter: `drop-shadow(0 0 20px ${color})` }}
          >
            <Pokeball size={88} color={color} />
          </span>
        </span>

        <div aria-live="polite" className="min-h-40 w-full">
          {settled && (
            <div className="animate-bloom flex flex-col items-center gap-1">
              {caught ? (
                <>
                  <p className="text-sm tracking-[0.32em] text-drift uppercase">{t.play.caught}</p>
                  <p
                    className="text-[clamp(30px,9vw,46px)] leading-none tracking-[0.12em] uppercase"
                    style={{ color, textShadow: `0 0 22px ${color}, 0 3px 0 rgb(0 0 0 / 0.6)` }}
                  >
                    {t.tiers[result.tier]}
                  </p>
                  <p className="mt-1 text-[22px] tracking-[0.08em]">{result.entity!.names[lang]}</p>
                  {correctedFrom && (
                    <p className="text-base text-drift">{fill(t.play.corrected, { input: correctedFrom })}</p>
                  )}
                </>
              ) : (
                <p
                  className="text-[clamp(26px,7.5vw,38px)] leading-tight tracking-[0.08em] uppercase"
                  style={{ color: "var(--color-drift)", textShadow: "0 3px 0 rgb(0 0 0 / 0.6)" }}
                >
                  {t.play.escaped}
                </p>
              )}
              <p className="glow mt-1 text-[26px] tabular-nums" style={{ color: caught ? color : "var(--color-drift)" }}>
                {fill(t.play.points, { points: `+${result.points}` })}
              </p>
              {note && <p className="mt-1 text-base tracking-[0.14em] text-ball-red uppercase">{note}</p>}
            </div>
          )}
        </div>

        {settled && <CatchLadder tier={result.tier} />}
      </div>

      {settled && (
        <div className="animate-rise sticky bottom-0 flex justify-center pt-4 pb-3">
          <button autoFocus onClick={onNext} className="btn-ring px-8 pt-3 pb-2.5 text-[22px]">
            {isLast ? t.play.toSummary : t.play.next} ▸
          </button>
        </div>
      )}
    </div>
  );
}
