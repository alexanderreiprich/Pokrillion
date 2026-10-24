import type { ReactNode } from "react";
import type { TierId } from "@/lib/game/tiers";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";

/** Top bar during a run: progress in the middle, score pod on the right. Leaves room for the menu button. */
export function Hud({ children, score, scoreLabel }: { children: ReactNode; score: number; scoreLabel: string }) {
  return (
    <header className="animate-rise relative z-10 flex items-stretch justify-between gap-2 pl-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-1">{children}</div>
      <div className="pod min-w-[86px] px-2.5 pt-1 pb-1.5 text-right">
        <p className="text-[10px] tracking-[0.3em] text-drift uppercase">{scoreLabel}</p>
        {/* remounts on change to replay the slam */}
        <p key={score} className="animate-slam glow text-[25px] leading-none text-ball-red tabular-nums">
          {score}
        </p>
      </div>
    </header>
  );
}

/** One ball per question: tier colour once answered, pulsing red for the current one. */
export function ProgressBalls({
  total,
  tiers,
  current,
}: {
  total: number;
  /** tier per answered position (1-based) */
  tiers: Partial<Record<number, TierId>>;
  current: number;
}) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const position = i + 1;
        const tier = tiers[position];
        if (tier) {
          const color = TIER_COLOR[tier];
          return (
            <span key={position} style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
              <Pokeball size={14} color={color} />
            </span>
          );
        }
        return (
          <span key={position} className={position === current ? "animate-dot" : "opacity-30 grayscale"}>
            <Pokeball size={14} />
          </span>
        );
      })}
    </div>
  );
}

export function HudLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] tracking-[0.22em] text-drift uppercase">{children}</p>;
}
