import { TIERS, type TierId } from "@/lib/game/tiers";
import { SCORING } from "@/lib/game/scoring";
import { Pokeball } from "./Pokeball";
import { TIER_COLOR } from "./tier-colors";

/** Point range per tier, derived from the tier thresholds. */
function range(index: number): string {
  const tier = TIERS[index];
  if (tier.id === "miss") return "0";
  if (tier.id === "masterball") return String(SCORING.masterballPoints);
  const next = TIERS[index + 1];
  const max = next.id === "masterball" ? SCORING.maxPoints : next.minPoints - SCORING.roundTo;
  return `${tier.minPoints}–${max}`;
}

/** The tiers as dashed lines, rarest at the bottom (Krillion's depth lines). */
export function TierList({ labels }: { labels: Record<TierId, string> }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {TIERS.map((tier, i) => (
        <li key={tier.id} className="flex items-center gap-2.5 text-lg tracking-[0.12em] uppercase">
          <Pokeball size={18} color={TIER_COLOR[tier.id]} />
          <span className="glow" style={{ color: TIER_COLOR[tier.id] }}>
            {labels[tier.id]}
          </span>
          <span
            aria-hidden
            className="flex-1 border-t-2 border-dashed opacity-50"
            style={{ borderColor: TIER_COLOR[tier.id] }}
          />
          <span className="text-drift tabular-nums">{range(i)}</span>
        </li>
      ))}
    </ul>
  );
}
