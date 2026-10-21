"use client";

import { useEffect, useState } from "react";
import type { QuestionResult } from "@/lib/api/types";
import type { Locale } from "@/lib/content/schema";
import { fill } from "@/i18n/fill";
import { DialogBox } from "@/components/DialogBox";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";
import type { GameTexts } from "./Game";

const WOBBLE_MS = 1200;

/** Ball wobbles, then: "Gotcha! Lunatone · Master Ball · 100 pts" (or "It got away!"). */
export function RevealView({
  result,
  correctedFrom,
  isLast,
  lang,
  t,
  onNext,
}: {
  result: QuestionResult;
  correctedFrom: string | null;
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
    <div className="flex flex-col items-center gap-6 py-4">
      <div className={settled && result.tier === "masterball" ? "animate-sparkle" : undefined}>
        <Pokeball size={96} color={color} className={caught ? "animate-wobble" : "opacity-60"} />
      </div>

      <div className="w-full" aria-live="polite">
        {settled && (
          <DialogBox arrow={false}>
            <div className="animate-pop flex flex-col gap-1">
              {caught ? (
                <>
                  <span>
                    {t.play.caught} <strong>{result.entity!.names[lang]}</strong>
                  </span>
                  {correctedFrom && (
                    <span className="text-lg opacity-70">{fill(t.play.corrected, { input: correctedFrom })}</span>
                  )}
                </>
              ) : (
                <span>{t.play.escaped}</span>
              )}
              <span className="flex items-baseline justify-between">
                <span style={{ color: result.tier === "miss" ? undefined : color }} className="font-display text-xl">
                  {t.tiers[result.tier]}
                </span>
                <span className="text-4xl leading-none">+{result.points}</span>
              </span>
            </div>
          </DialogBox>
        )}
      </div>

      {settled && (
        <button
          autoFocus
          onClick={onNext}
          className="pixel-button animate-pop bg-ball-red px-8 py-1.5 font-display text-2xl text-moon hover:brightness-110"
        >
          {isLast ? t.play.toSummary : t.play.next}
        </button>
      )}
    </div>
  );
}
