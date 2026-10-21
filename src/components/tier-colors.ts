import type { TierId } from "@/lib/game/tiers";

export const TIER_COLOR: Record<TierId, string> = {
  miss: "var(--color-tier-miss)",
  pokeball: "var(--color-tier-pokeball)",
  superball: "var(--color-tier-superball)",
  hyperball: "var(--color-tier-hyperball)",
  shiny: "var(--color-tier-shiny)",
  masterball: "var(--color-tier-masterball)",
};
