import { Fragment } from "react";
import { TIERS, type TierId } from "@/lib/game/tiers";
import { Pokeball } from "@/components/Pokeball";
import { TIER_COLOR } from "@/components/tier-colors";

const LADDER = TIERS.filter((t) => t.id !== "miss");

/** All catch tiers in a row; they light up one after another up to the one reached. Decorative. */
export function CatchLadder({ tier }: { tier: TierId }) {
  const reached = LADDER.findIndex((t) => t.id === tier);

  return (
    <div aria-hidden className="flex w-full max-w-xs items-center">
      {LADDER.map((t, i) => {
        const lit = i <= reached;
        const color = TIER_COLOR[t.id];
        return (
          <Fragment key={t.id}>
            {i > 0 && (
              <span
                className="flex-1 border-t-2 border-dashed"
                style={{ borderColor: lit ? color : "rgb(125 147 184 / 0.3)" }}
              />
            )}
            <span
              className={lit ? "animate-light-up" : "opacity-30 grayscale"}
              style={lit ? { animationDelay: `${i * 0.12}s` } : undefined}
            >
              <span className="block" style={lit ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}>
                <Pokeball size={i === reached ? 30 : 20} color={color} />
              </span>
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
