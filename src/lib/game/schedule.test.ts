import { describe, expect, it } from "vitest";
import { planPuzzle, type PlannableQuestion } from "./schedule";
import { isExpired, remainingSeconds } from "./timer";
import { indexFromAliases, matchInput } from "./match";

const q = (id: string, category: PlannableQuestion["category"], group?: string, difficulty = 2): PlannableQuestion => ({
  id,
  category,
  group,
  difficulty,
  cooldownDays: 120,
});

const bank: PlannableQuestion[] = [
  q("p.color.yellow", "pokedex", "color", 1),
  q("p.color.red", "pokedex", "color", 1),
  q("p.type.ghost", "pokedex", "type", 2),
  q("p.type.dragon", "pokedex", "type", 3),
  q("p.legendary", "pokedex", undefined, 2),
  q("p.starter", "pokedex", undefined, 1),
  q("g.cave", "games", "location", 3),
  q("g.move.fire", "games", "move", 2),
  q("g.region", "games", undefined, 1),
  q("g.ball", "games", "item", 2),
  q("a.companions", "anime", "ash", 2),
];

describe("planPuzzle", () => {
  it("picks 7 questions with category quotas and distinct groups", () => {
    const plan = planPuzzle("2026-10-21", bank, new Map());
    expect(plan).toHaveLength(7);
    expect(new Set(plan).size).toBe(7);
    const byId = new Map(bank.map((b) => [b.id, b]));
    const picked = plan.map((id) => byId.get(id)!);
    expect(picked.filter((p) => p.category === "pokedex").length).toBeGreaterThanOrEqual(3);
    expect(picked.filter((p) => p.category === "games").length).toBeGreaterThanOrEqual(3);
    const groups = picked.map((p) => p.group).filter(Boolean);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("orders by difficulty", () => {
    const byId = new Map(bank.map((b) => [b.id, b]));
    const difficulties = planPuzzle("2026-10-21", bank, new Map()).map((id) => byId.get(id)!.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });

  it("is deterministic per date", () => {
    expect(planPuzzle("2026-10-22", bank, new Map())).toEqual(planPuzzle("2026-10-22", bank, new Map()));
  });

  it("prefers questions outside their cooldown", () => {
    const lastUsed = new Map([
      ["p.color.yellow", "2026-10-20"],
      ["g.region", "2026-10-20"],
    ]);
    const plan = planPuzzle("2026-10-21", bank, lastUsed);
    expect(plan).not.toContain("p.color.yellow");
    expect(plan).not.toContain("g.region");
  });

  it("falls back to least recently used when the bank is small", () => {
    const lastUsed = new Map(bank.map((b) => [b.id, "2026-10-20"]));
    lastUsed.set("g.cave", "2026-10-01");
    const plan = planPuzzle("2026-10-21", bank, lastUsed);
    expect(plan).toHaveLength(7);
    expect(plan).toContain("g.cave");
  });

  it("fails loudly when not enough questions exist", () => {
    expect(() => planPuzzle("2026-10-21", bank.slice(0, 4), new Map())).toThrow(/nur/);
  });
});

describe("timer", () => {
  const startedAt = new Date("2026-10-21T10:00:00Z");

  it("counts down including penalties", () => {
    const now = new Date("2026-10-21T10:00:10Z");
    expect(remainingSeconds({ startedAt, timeLimitS: 25, penaltyS: 0 }, now)).toBe(15);
    expect(remainingSeconds({ startedAt, timeLimitS: 25, penaltyS: 6 }, now)).toBe(9);
  });

  it("expires only after the grace period", () => {
    expect(isExpired({ startedAt, timeLimitS: 25, penaltyS: 0 }, new Date("2026-10-21T10:00:26Z"))).toBe(false);
    expect(isExpired({ startedAt, timeLimitS: 25, penaltyS: 0 }, new Date("2026-10-21T10:00:28Z"))).toBe(true);
  });
});

describe("indexFromAliases", () => {
  it("builds the same index as from names", () => {
    const index = indexFromAliases([
      { alias: "glurak", entity_id: "pokemon:charizard" },
      { alias: "charizard", entity_id: "pokemon:charizard" },
    ]);
    expect(matchInput(index, "Glurack")).toMatchObject({ type: "fuzzy", entityId: "pokemon:charizard" });
  });
});
