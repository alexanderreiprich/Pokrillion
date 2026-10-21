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

export function TierList({ labels }: { labels: Record<TierId, string> }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {[...TIERS].reverse().map((tier) => (
        <li key={tier.id} className="flex items-center gap-2">
          <Pokeball size={18} color={TIER_COLOR[tier.id]} />
          <span style={{ color: TIER_COLOR[tier.id] }}>{labels[tier.id]}</span>
          <span className="ml-auto text-drift">{range(TIERS.indexOf(tier))}</span>
        </li>
      ))}
    </ul>
  );
}
