/**
 * Downloads the PokéAPI CSV dump (cached in data/pokeapi/) and turns it into
 * entity files in data/generated/*.json with German + English names.
 *
 *   npm run data:import            use cache where present
 *   npm run data:import -- --fresh re-download everything
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { Entity } from "../src/lib/content/schema";
import { normalize } from "../src/lib/game/normalize";

const BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, "data", "pokeapi");
const OUT_DIR = path.join(ROOT, "data", "generated");
const FRESH = process.argv.includes("--fresh");

const LANG_DE = "6";
const LANG_EN = "9";

type Row = Record<string, string>;

async function loadCsv(name: string): Promise<Row[]> {
  const file = path.join(CACHE_DIR, `${name}.csv`);
  const cached = await stat(file).then(() => true, () => false);
  if (!cached || FRESH) {
    const res = await fetch(`${BASE}/${name}.csv`);
    if (!res.ok) throw new Error(`${name}.csv: HTTP ${res.status}`);
    await writeFile(file, await res.text(), "utf8");
    console.log(`  ↓ ${name}.csv`);
  }
  return parse(await readFile(file, "utf8"), { columns: true, skip_empty_lines: true });
}

/** id → { de, en } from a *_names.csv table. Falls back to EN when DE is missing. */
function namesById(rows: Row[], idCol: string): Map<string, { de: string; en: string }> {
  const de = new Map<string, string>();
  const en = new Map<string, string>();
  for (const r of rows) {
    if (!r.name?.trim()) continue;
    if (r.local_language_id === LANG_DE) de.set(r[idCol], r.name.trim());
    if (r.local_language_id === LANG_EN) en.set(r[idCol], r.name.trim());
  }
  const out = new Map<string, { de: string; en: string }>();
  for (const [id, enName] of en) out.set(id, { de: de.get(id) ?? enName, en: enName });
  return out;
}

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Several PokéAPI entries share a name (Victory Road per region, Hisuian Poké Balls, …).
 * Players can't tell them apart, so they become one entity; differing attrs turn into arrays.
 */
function mergeSameName(entities: Entity[]): Entity[] {
  const groups = new Map<string, Entity[]>();
  for (const e of entities) {
    // Normalized, so "Hau’oli City" and "Hau'oli City" become one entity too.
    const key = normalize(e.names.en);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const attrs: Entity["attrs"] = {};
    for (const key of new Set(group.flatMap((e) => Object.keys(e.attrs)))) {
      const values = [...new Set(group.flatMap((e) => e.attrs[key] ?? []))] as string[];
      attrs[key] = values.length === 1 ? values[0] : values;
    }
    return {
      ...group[0],
      id: `${group[0].kind}:${slugify(group[0].names.en)}`,
      attrs,
      familiarity: Math.max(...group.map((e) => e.familiarity)),
    };
  });
}

function clampFamiliarity(n: number) {
  return Math.max(1, Math.min(100, Math.round(n)));
}

/** Rough baseline: earlier generations are better known. Curated overrides live in content/familiarity. */
const GEN_FAMILIARITY: Record<number, number> = { 1: 55, 2: 42, 3: 38, 4: 34, 5: 28, 6: 28, 7: 28, 8: 26, 9: 26 };
const REGION_FAMILIARITY: Record<string, number> = { kanto: 60, johto: 45, hoenn: 45, sinnoh: 40 };

async function buildPokemon(): Promise<Entity[]> {
  const [species, speciesNames, pokemon, pokemonTypes, types, colors, evolutions, items] = await Promise.all([
    loadCsv("pokemon_species"),
    loadCsv("pokemon_species_names"),
    loadCsv("pokemon"),
    loadCsv("pokemon_types"),
    loadCsv("types"),
    loadCsv("pokemon_colors"),
    loadCsv("pokemon_evolution"),
    loadCsv("items"),
  ]);
  const names = namesById(speciesNames, "pokemon_species_id");
  const typeSlug = new Map(types.map((t) => [t.id, t.identifier]));
  const colorSlug = new Map(colors.map((c) => [c.id, c.identifier]));
  const speciesSlug = new Map(species.map((s) => [s.id, s.identifier]));
  const evolvesFrom = new Map(species.map((s) => [s.id, s.evolves_from_species_id]));

  const defaultPokemonOfSpecies = new Map<string, string>();
  for (const p of pokemon) if (p.is_default === "1") defaultPokemonOfSpecies.set(p.species_id, p.id);
  const typesOfPokemon = new Map<string, string[]>();
  for (const pt of [...pokemonTypes].sort((a, b) => Number(a.slot) - Number(b.slot))) {
    const list = typesOfPokemon.get(pt.pokemon_id) ?? [];
    list.push(typeSlug.get(pt.type_id)!);
    typesOfPokemon.set(pt.pokemon_id, list);
  }
  const stageOf = (id: string): number => (evolvesFrom.get(id) ? 1 + stageOf(evolvesFrom.get(id)!) : 1);

  // Alternate forms, detected from the non-default pokemon identifiers ("charizard-mega-x", "vulpix-alola", …).
  const FORM_PATTERN = /-(mega|alola|galar|hisui|paldea|gmax)(-|$)/;
  const formsOfSpecies = new Map<string, Set<string>>();
  for (const p of pokemon) {
    // "pikachu-alola-cap" is Pikachu wearing Ash's cap, not a regional form.
    if (p.identifier.endsWith("-cap")) continue;
    const form = p.identifier.match(FORM_PATTERN)?.[1];
    if (!form) continue;
    formsOfSpecies.set(p.species_id, (formsOfSpecies.get(p.species_id) ?? new Set()).add(form));
  }

  // Evolution items (stones etc.) and trade evolutions, recorded on *both* sides of the evolution:
  // "Name a Pokémon from a Fire Stone evolution" accepts Vulpix as well as Ninetales.
  const itemSlug = new Map(items.map((i) => [i.id, i.identifier]));
  const evoItems = new Map<string, Set<string>>();
  const evoTrade = new Set<string>();
  for (const e of evolutions) {
    const from = evolvesFrom.get(e.evolved_species_id);
    const sides = from ? [e.evolved_species_id, from] : [e.evolved_species_id];
    if (e.evolution_trigger_id === "3" && e.trigger_item_id) {
      for (const id of sides) evoItems.set(id, (evoItems.get(id) ?? new Set()).add(itemSlug.get(e.trigger_item_id)!));
    }
    if (e.evolution_trigger_id === "2") sides.forEach((id) => evoTrade.add(id));
  }

  return species.map((s) => {
    const n = names.get(s.id);
    if (!n) throw new Error(`Kein Name für Spezies ${s.identifier}`);
    const generation = Number(s.generation_id);
    const legendary = s.is_legendary === "1";
    const mythical = s.is_mythical === "1";
    const aliases: string[] = [];
    if (s.identifier === "nidoran-f") aliases.push("Nidoran w", "Nidoran weiblich", "Nidoran female");
    if (s.identifier === "nidoran-m") aliases.push("Nidoran männlich", "Nidoran male");
    return {
      id: `pokemon:${s.identifier}`,
      kind: "pokemon",
      names: n,
      aliases,
      attrs: {
        dex: Number(s.id),
        generation,
        color: colorSlug.get(s.color_id)!,
        types: typesOfPokemon.get(defaultPokemonOfSpecies.get(s.id)!) ?? [],
        legendary,
        mythical,
        baby: s.is_baby === "1",
        stage: stageOf(s.id),
        ...(s.evolves_from_species_id ? { evolvesFrom: speciesSlug.get(s.evolves_from_species_id)! } : {}),
        ...(formsOfSpecies.has(s.id) ? { forms: [...formsOfSpecies.get(s.id)!].sort() } : {}),
        ...(evoItems.has(s.id) ? { evoItems: [...evoItems.get(s.id)!].sort() } : {}),
        ...(evoTrade.has(s.id) ? { evoTrade: true } : {}),
      },
      familiarity: clampFamiliarity((GEN_FAMILIARITY[generation] ?? 30) + (legendary || mythical ? 10 : 0)),
    } satisfies Entity;
  });
}

async function buildTypes(): Promise<Entity[]> {
  const [types, typeNames] = await Promise.all([loadCsv("types"), loadCsv("type_names")]);
  const names = namesById(typeNames, "type_id");
  return types
    // 10001+ are "unknown"/"shadow", stellar is a Tera-only pseudo type.
    .filter((t) => Number(t.id) < 10000 && t.identifier !== "stellar")
    .map((t) => ({
      id: `type:${t.identifier}`,
      kind: "type",
      names: names.get(t.id)!,
      aliases: [],
      attrs: { generation: Number(t.generation_id) },
      familiarity: 70,
    }));
}

/** Game editions. DLCs are skipped, the Japanese-only re-releases merge with their namesakes. */
async function buildGames(): Promise<Entity[]> {
  const [versions, versionNames, versionGroups] = await Promise.all([
    loadCsv("versions"),
    loadCsv("version_names"),
    loadCsv("version_groups"),
  ]);
  const names = namesById(versionNames, "version_id");
  const generation = new Map(versionGroups.map((g) => [g.id, Number(g.generation_id)]));
  const DLC = /isle-of-armor|crown-tundra|teal-mask|indigo-disk|mega-dimension/;
  return mergeSameName(
    versions
      .filter((v) => !DLC.test(v.identifier) && names.has(v.id))
      .map((v): Entity => {
        const n = names.get(v.id)!;
        const gen = generation.get(v.version_group_id)!;
        return {
          id: `game:${v.identifier}`,
          kind: "game",
          names: n,
          aliases: [...new Set([`Pokémon ${n.de}`, `Pokémon ${n.en}`, ...(v.identifier === "green-japan" ? ["Grün", "Pokémon Grün"] : [])])],
          attrs: { generation: gen },
          familiarity: GEN_FAMILIARITY[gen] ?? 30,
        };
      }),
  );
}

async function buildRegions(): Promise<Entity[]> {
  const [regions, regionNames] = await Promise.all([loadCsv("regions"), loadCsv("region_names")]);
  const names = namesById(regionNames, "region_id");
  return regions.map((r, i) => ({
    id: `region:${r.identifier}`,
    kind: "region",
    names: names.get(r.id) ?? { de: r.identifier, en: r.identifier },
    aliases: [],
    attrs: {},
    familiarity: clampFamiliarity(80 - i * 5),
  }));
}

async function buildLocations(): Promise<Entity[]> {
  const [locations, locationNames, regions] = await Promise.all([
    loadCsv("locations"),
    loadCsv("location_names"),
    loadCsv("regions"),
  ]);
  const names = namesById(locationNames, "location_id");
  const regionSlug = new Map(regions.map((r) => [r.id, r.identifier]));
  return mergeSameName(locations
    .filter((l) => names.has(l.id))
    .map((l): Entity => {
      const region = regionSlug.get(l.region_id);
      return {
        id: `location:${l.identifier}`,
        kind: "location",
        names: names.get(l.id)!,
        aliases: [],
        attrs: region ? { region } : {},
        familiarity: region ? (REGION_FAMILIARITY[region] ?? 30) : 20,
      };
    }));
}

async function buildMoves(): Promise<Entity[]> {
  const [moves, moveNames, types] = await Promise.all([loadCsv("moves"), loadCsv("move_names"), loadCsv("types")]);
  const names = namesById(moveNames, "move_id");
  const typeSlug = new Map(types.map((t) => [t.id, t.identifier]));
  return mergeSameName(moves
    // 10001+ are Colosseum/XD shadow moves.
    .filter((m) => Number(m.id) < 10000 && names.has(m.id))
    .map((m): Entity => {
      const generation = Number(m.generation_id);
      return {
        id: `move:${m.identifier}`,
        kind: "move",
        names: names.get(m.id)!,
        aliases: [],
        attrs: { generation, type: typeSlug.get(m.type_id)! },
        familiarity: generation === 1 ? 50 : 30,
      };
    }));
}

async function buildItems(): Promise<Entity[]> {
  const [items, itemNames, categories, pockets] = await Promise.all([
    loadCsv("items"),
    loadCsv("item_names"),
    loadCsv("item_categories"),
    loadCsv("item_pockets"),
  ]);
  const names = namesById(itemNames, "item_id");
  const category = new Map(categories.map((c) => [c.id, c]));
  const pocketSlug = new Map(pockets.map((p) => [p.id, p.identifier]));
  return mergeSameName(items
    .filter((i) => names.has(i.id))
    .map((i): Entity => {
      const cat = category.get(i.category_id);
      return {
        id: `item:${i.identifier}`,
        kind: "item",
        names: names.get(i.id)!,
        aliases: [],
        attrs: {
          ...(cat ? { category: cat.identifier, pocket: pocketSlug.get(cat.pocket_id)! } : {}),
        },
        familiarity: 30,
      };
    }));
}

async function buildAbilities(): Promise<Entity[]> {
  const [abilities, abilityNames] = await Promise.all([loadCsv("abilities"), loadCsv("ability_names")]);
  const names = namesById(abilityNames, "ability_id");
  return mergeSameName(abilities
    .filter((a) => a.is_main_series === "1" && names.has(a.id))
    .map((a): Entity => ({
      id: `ability:${a.identifier}`,
      kind: "ability",
      names: names.get(a.id)!,
      aliases: [],
      attrs: { generation: Number(a.generation_id) },
      familiarity: 30,
    })));
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const builders: Record<string, () => Promise<Entity[]>> = {
    pokemon: buildPokemon,
    types: buildTypes,
    regions: buildRegions,
    games: buildGames,
    locations: buildLocations,
    moves: buildMoves,
    items: buildItems,
    abilities: buildAbilities,
  };

  for (const [name, build] of Object.entries(builders)) {
    const entities = await build();
    // One entity per line keeps git diffs readable.
    const json = "[\n" + entities.map((e) => "  " + JSON.stringify(e)).join(",\n") + "\n]\n";
    await writeFile(path.join(OUT_DIR, `${name}.json`), json, "utf8");
    console.log(`✓ ${name}: ${entities.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
