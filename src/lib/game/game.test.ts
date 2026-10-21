import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import { buildIndex, matchInput, maxDistance, osaDistance } from "./match";
import { evaluateGuess } from "./guess";
import { SCORING, answerShare, pointsForShare, priorShares, scoreAnswer } from "./scoring";
import { tierForPoints } from "./tiers";
import { isPlayableDate, localIsoDate, parseIsoDate, puzzleNumber } from "./puzzle-date";
import { buildShareText } from "./share";

describe("normalize", () => {
  it.each([
    ["Mr. Mime", "mrmime"],
    ["Pokémon", "pokemon"],
    ["  PIKACHU ", "pikachu"],
    ["Nidoran♀", "nidoranf"],
    ["Farfetch’d", "farfetchd"],
    ["Porygon-Z", "porygonz"],
    ["Glumanda", "glumanda"],
    ["Kühlkies", "kuhlkies"],
    ["Weißer Ball", "weisserball"],
    ["ピカチュウ", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("osaDistance", () => {
  it("counts edits and adjacent swaps", () => {
    expect(osaDistance("pikachu", "pikachu")).toBe(0);
    expect(osaDistance("pikachu", "pickachu")).toBe(1);
    expect(osaDistance("pikachu", "pikahcu")).toBe(1);
    expect(osaDistance("glurak", "glumanda")).toBe(4);
  });

  it("stops at the cutoff", () => {
    expect(osaDistance("abcdefgh", "zzzzzzzz", 2)).toBe(2);
    expect(osaDistance("a", "abcdef", 3)).toBe(3);
  });
});

describe("maxDistance", () => {
  it("allows more typos for longer names", () => {
    expect(maxDistance(4)).toBe(0);
    expect(maxDistance(6)).toBe(1);
    expect(maxDistance(10)).toBe(2);
  });
});

const universe = [
  { id: "pokemon:pikachu", names: { de: "Pikachu", en: "Pikachu" } },
  { id: "pokemon:charizard", names: { de: "Glurak", en: "Charizard" } },
  { id: "pokemon:golbat", names: { de: "Golbat", en: "Golbat" } },
  { id: "pokemon:golett", names: { de: "Golbit", en: "Golett" } },
  { id: "pokemon:gengar", names: { de: "Gengar", en: "Gengar" } },
  { id: "pokemon:mr-mime", names: { de: "Pantimos", en: "Mr. Mime" } },
  { id: "pokemon:nidoran-f", names: { de: "Nidoran♀", en: "Nidoran♀" }, aliases: ["Nidoran female"] },
  { id: "pokemon:nidoran-m", names: { de: "Nidoran♂", en: "Nidoran♂" } },
];
const index = buildIndex(universe);

describe("matchInput", () => {
  it("matches German and English names", () => {
    expect(matchInput(index, "glurak")).toMatchObject({ type: "exact", entityId: "pokemon:charizard" });
    expect(matchInput(index, "Charizard")).toMatchObject({ type: "exact", entityId: "pokemon:charizard" });
  });

  it("tolerates typos", () => {
    expect(matchInput(index, "Pickachu")).toMatchObject({ type: "fuzzy", entityId: "pokemon:pikachu" });
    expect(matchInput(index, "mr mine")).toMatchObject({ type: "fuzzy", entityId: "pokemon:mr-mime" });
  });

  it("keeps gendered names apart", () => {
    expect(matchInput(index, "Nidoran♂")).toMatchObject({ type: "exact", entityId: "pokemon:nidoran-m" });
    expect(matchInput(index, "nidoran female")).toMatchObject({ type: "exact", entityId: "pokemon:nidoran-f" });
  });

  it("rejects garbage", () => {
    expect(matchInput(index, "Digimon")).toEqual({ type: "none" });
    expect(matchInput(index, "!!!")).toEqual({ type: "none" });
  });
});

describe("evaluateGuess", () => {
  const ghosts = new Set(["pokemon:golett", "pokemon:gengar"]);

  it("accepts a valid answer", () => {
    expect(evaluateGuess(index, ghosts, "Gengar")).toEqual({
      result: "valid",
      entityId: "pokemon:gengar",
      corrected: false,
    });
  });

  it("does not fuzzy-correct a real but wrong Pokémon into a valid one", () => {
    // Golbat is one letter away from Golbit (Golett) but is not a ghost.
    expect(evaluateGuess(index, ghosts, "Golbat")).toEqual({ result: "wrong_entity", entityId: "pokemon:golbat" });
  });

  it("flags known but wrong answers", () => {
    expect(evaluateGuess(index, ghosts, "Pikachu")).toEqual({ result: "wrong_entity", entityId: "pokemon:pikachu" });
  });

  it("accepts an exact name shared by two valid entities", () => {
    const twins = buildIndex([
      { id: "location:hauoli-city", names: { de: "Hauholi City", en: "Hau’oli City" } },
      { id: "location:hauoli-city-2", names: { de: "Hauholi City", en: "Hau'oli City" } },
    ]);
    expect(evaluateGuess(twins, new Set(["location:hauoli-city", "location:hauoli-city-2"]), "hauholi city")).toEqual({
      result: "valid",
      entityId: "location:hauoli-city",
      corrected: false,
    });
  });

  it("resolves exact name collisions toward the valid entity", () => {
    const twins = buildIndex([
      { id: "type:psychic", names: { de: "Psycho", en: "Psychic" } },
      { id: "move:psychic", names: { de: "Psychokinese", en: "Psychic" } },
    ]);
    expect(evaluateGuess(twins, new Set(["move:psychic"]), "psychic")).toMatchObject({
      result: "valid",
      entityId: "move:psychic",
    });
  });
});

describe("scoring", () => {
  const prior = priorShares(
    new Map([
      ["pokemon:pikachu", 100],
      ["pokemon:raichu", 70],
      ["pokemon:lunatone", 25],
      ["pokemon:pamo", 10],
    ]),
  );

  it("prior shares sum to 1 and favour familiar answers", () => {
    const sum = [...prior.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(prior.get("pokemon:pikachu")!).toBeGreaterThan(prior.get("pokemon:raichu")!);
  });

  it("maps shares onto 10 … 85 in steps of 5", () => {
    expect(pointsForShare(0.5)).toBe(SCORING.minPoints);
    expect(pointsForShare(SCORING.shareHi)).toBe(SCORING.minPoints);
    expect(pointsForShare(SCORING.shareLo)).toBe(SCORING.maxPoints);
    expect(pointsForShare(0.0001)).toBe(SCORING.maxPoints);
    const mid = pointsForShare(0.02);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(85);
    expect(mid % 5).toBe(0);
  });

  it("uses the prior before anyone has played", () => {
    const pikachu = scoreAnswer({
      entityId: "pokemon:pikachu",
      masterballId: "pokemon:lunatone",
      priorShare: prior.get("pokemon:pikachu")!,
      count: 0,
      total: 0,
    });
    const pamo = scoreAnswer({
      entityId: "pokemon:pamo",
      masterballId: "pokemon:lunatone",
      priorShare: prior.get("pokemon:pamo")!,
      count: 0,
      total: 0,
    });
    expect(pikachu).toBe(10);
    expect(pamo).toBeGreaterThan(pikachu);
  });

  it("lets real player data override the prior", () => {
    const p = prior.get("pokemon:pamo")!;
    // Nobody knows Pamo in theory, but 60 % of 1000 players named it.
    expect(answerShare(p, 600, 1000)).toBeGreaterThan(0.5);
    expect(pointsForShare(answerShare(p, 600, 1000))).toBe(10);
  });

  it("awards 100 for the masterball answer", () => {
    expect(
      scoreAnswer({ entityId: "pokemon:lunatone", masterballId: "pokemon:lunatone", priorShare: 0.1, count: 0, total: 0 }),
    ).toBe(100);
  });
});

describe("tiers", () => {
  it.each([
    [0, "miss"],
    [10, "pokeball"],
    [20, "pokeball"],
    [25, "superball"],
    [45, "superball"],
    [50, "hyperball"],
    [70, "hyperball"],
    [75, "shiny"],
    [85, "shiny"],
    [100, "masterball"],
  ])("%i points → %s", (points, tier) => {
    expect(tierForPoints(points).id).toBe(tier);
  });
});

describe("puzzle dates", () => {
  it("parses only real dates", () => {
    expect(parseIsoDate("2026-11-01")).not.toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("1.11.2026")).toBeNull();
  });

  it("numbers puzzles from launch", () => {
    expect(puzzleNumber("2026-10-21")).toBe(1);
    expect(puzzleNumber("2026-10-22")).toBe(2);
    expect(puzzleNumber("2027-10-21")).toBe(366);
  });

  it("accepts today ± 1 day after launch", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(isPlayableDate("2026-11-10", now)).toBe(true);
    expect(isPlayableDate("2026-11-11", now)).toBe(true);
    expect(isPlayableDate("2026-11-09", now)).toBe(true);
    expect(isPlayableDate("2026-11-12", now)).toBe(false);
    expect(isPlayableDate("2026-10-20", new Date("2026-10-20T12:00:00Z"))).toBe(false);
  });

  it("formats the local date", () => {
    expect(localIsoDate(new Date(2026, 10, 5, 23, 59))).toBe("2026-11-05");
  });
});

describe("buildShareText", () => {
  it("renders score and tier emojis", () => {
    expect(buildShareText({ number: 42, points: [10, 30, 80, null, 55, 100, 25] })).toBe(
      "Pokrillion #42 · 300/700\n🔴🔵✨💨🟡🟣🔵\npokrillion.io",
    );
  });
});
