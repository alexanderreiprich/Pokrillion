import { describe, expect, it } from "vitest";
import { Question, type Entity } from "./schema";
import { matchesQuery, resolveContent } from "./resolve";

const mon = (slug: string, de: string, attrs: Entity["attrs"], familiarity = 50): Entity => ({
  id: `pokemon:${slug}`,
  kind: "pokemon",
  names: { de, en: slug },
  aliases: [],
  attrs,
  familiarity,
});

const entities: Entity[] = [
  mon("pikachu", "Pikachu", { color: "yellow", types: ["electric"] }, 100),
  mon("lunatone", "Lunastein", { color: "yellow", types: ["rock", "psychic"] }, 25),
  mon("golbat", "Golbat", { color: "purple", types: ["poison", "flying"] }),
  mon("golett", "Golbit", { color: "green", types: ["ground", "ghost"] }),
  mon("gengar", "Gengar", { color: "purple", types: ["ghost", "poison"] }),
];

const question = (answers: unknown, masterball = "pokemon:lunatone") =>
  Question.parse({
    id: "test.q",
    category: "pokedex",
    difficulty: 1,
    prompt: { de: "x", en: "x" },
    answers,
    masterball,
  });

describe("matchesQuery", () => {
  it("matches scalar and array attrs", () => {
    expect(matchesQuery(entities[0], { kind: "pokemon", where: { color: "yellow" } })).toBe(true);
    expect(matchesQuery(entities[4], { kind: "pokemon", where: { types: "ghost" } })).toBe(true);
    expect(matchesQuery(entities[0], { kind: "pokemon", where: { color: ["purple", "yellow"] } })).toBe(true);
    expect(matchesQuery(entities[0], { kind: "location" })).toBe(false);
  });

  it("matches names by regex in either language", () => {
    expect(matchesQuery(entities[1], { kind: "pokemon", nameMatches: "^luna" })).toBe(true);
  });
});

describe("resolveContent", () => {
  it("resolves queries, include/exclude and priors", () => {
    const { questions, problems } = resolveContent(entities, [
      question({ query: { kind: "pokemon", where: { color: "yellow" } }, include: ["pokemon:gengar"] }),
    ]);
    expect(problems.filter((p) => p.level === "error")).toEqual([]);
    const priors = questions[0].answerPriors;
    expect(Object.keys(priors).sort()).toEqual(["pokemon:gengar", "pokemon:lunatone", "pokemon:pikachu"]);
    expect(priors["pokemon:pikachu"]).toBeGreaterThan(priors["pokemon:lunatone"]);
    expect(questions[0].universe).toEqual(["pokemon"]);
  });

  it("unites multiple queries", () => {
    const { questions } = resolveContent(entities, [
      question({
        query: [
          { kind: "pokemon", where: { color: "yellow" } },
          { kind: "pokemon", where: { types: "ghost" } },
        ],
      }),
    ]);
    expect(Object.keys(questions[0].answerPriors)).toHaveLength(4);
  });

  it("reports curator mistakes", () => {
    const { problems } = resolveContent(entities, [
      question({ list: ["pokemon:pikachu", "pokemon:missingno"], exclude: ["pokemon:gengar"] }, "pokemon:gengar"),
    ]);
    const messages = problems.map((p) => `${p.level}: ${p.message}`);
    expect(messages).toContain("error: unbekannte Entity pokemon:missingno");
    expect(messages).toContain("warning: exclude: pokemon:gengar war gar nicht in der Lösungsmenge");
    expect(messages).toContain("error: Meisterball-Antwort pokemon:gengar ist nicht in der Lösungsmenge");
  });
});

describe("idMatches", () => {
  it("filters by entity id", () => {
    const city: Entity = {
      id: "location:pallet-town",
      kind: "location",
      names: { de: "Alabastia", en: "Pallet Town" },
      aliases: [],
      attrs: { region: "kanto" },
      familiarity: 95,
    };
    const route = { ...city, id: "location:kanto-route-1", names: { de: "Route 1", en: "Route 1" } };
    const query = { kind: "location" as const, where: { region: "kanto" }, idMatches: "-(city|town|village)$" };
    expect(matchesQuery(city, query)).toBe(true);
    expect(matchesQuery(route, query)).toBe(false);
  });
});
