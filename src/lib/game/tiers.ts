export const TIERS = [
  { id: "miss", minPoints: 0, emoji: "💨" },
  { id: "pokeball", minPoints: 10, emoji: "🔴" },
  { id: "superball", minPoints: 25, emoji: "🔵" },
  { id: "hyperball", minPoints: 50, emoji: "🟡" },
  { id: "shiny", minPoints: 75, emoji: "✨" },
  { id: "masterball", minPoints: 100, emoji: "🟣" },
] as const;

export type Tier = (typeof TIERS)[number];
export type TierId = Tier["id"];

export function tierForPoints(points: number): Tier {
  let tier: Tier = TIERS[0];
  for (const t of TIERS) if (points >= t.minPoints) tier = t;
  return tier;
}
