# Pokrillion.io

> *eins zu einer Pokrillion*: das tägliche Pokémon-Quiz, bei dem seltene Antworten mehr Punkte geben.

Inspiriert von [krillion.io](https://krillion.io/). Jeden Tag gibt es 7 Fragen aus Pokédex, Spielen und Anime, viele richtige Antworten und Punkte nach Seltenheit. Inoffizielles, nicht-kommerzielles Fanprojekt.

**Konzept & Architektur:** [`docs/KONZEPT.md`](docs/KONZEPT.md) · **Branches & Releases:** [`docs/BRANCHING.md`](docs/BRANCHING.md)

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres) · zod · Vitest

## Loslegen

```bash
npm install
npm run dev                 # http://localhost:3000 → leitet auf /de oder /en
npm test                    # Spiellogik-Tests
npm run typecheck && npm run lint
```

### Daten & Content

```bash
npm run data:import         # PokéAPI-CSVs → data/generated/*.json (Cache in data/pokeapi/, --fresh lädt neu)
npm run content:build       # content/*.yaml prüfen → build/content.json + supabase/seed.sql
```

Neue Fragen kommen nach `content/questions/*.yaml`. Das Format beschreibt `docs/KONZEPT.md` §8, das Schema liegt in `src/lib/content/schema.ts`. `content:build` meldet unbekannte IDs, leere Lösungsmengen, Meisterball-Antworten außerhalb der Lösungsmenge und Namenskollisionen.

### Datenbank (lokal)

Voraussetzung: Docker Desktop läuft.

```bash
npm run db:start            # lokales Supabase (erster Start lädt Images)
npx supabase status         # URL + service_role key → .env.local (Vorlage: .env.example)
npm run db:reset            # content:build + Migration + Seed neu einspielen (löscht Spiele + Planung!)
npm run schedule            # Tagesrätsel für die nächsten 15 Tage planen
```

Danach `npm run dev` und http://localhost:3000/de/play öffnen (Endlos-Modus: `/de/endless`).

**Kuratierung:** `ADMIN_PASSWORD=…` in `.env.local` setzen, Dev-Server neu starten, dann http://localhost:3000/de/admin (Benutzername egal). Ohne Passwort ist die Ansicht deaktiviert. Supabase Studio (Daten ansehen): http://127.0.0.1:54323

Ein heutiges Spiel nochmal spielen (lokal): in Studio die Zeilen in `plays` löschen, oder `docker exec supabase_db_Pokrillion psql -U postgres -c "delete from plays;"`.

## Deployment

Vercel (Production Branch `prod`) und ein Supabase-Cloud-Projekt. Environment Variables, Cron und Release-Ablauf: [`docs/BRANCHING.md`](docs/BRANCHING.md#deployment).

```bash
npx supabase link --project-ref <ref>   # einmalig
npx supabase db push                    # neue Migrationen vor dem Release anwenden
```

## Struktur

```
docs/            Konzept
content/         Fragen, kuratierte Entitäten, Bekanntheitswerte (YAML)
data/generated/  aus PokéAPI erzeugte Entitäten (committed)
scripts/         data-import, content-build, schedule
supabase/        Migrationen + generierter Seed
src/app/[lang]/  Seiten (de/en)
src/lib/game/    Spiellogik: Normalisierung, Matching, Scoring, Tiers, Timer, Planer, Share-Text
src/lib/server/  Server-Use-Cases (Spielablauf, Content-Cache) – nur server-seitig
src/components/game/  Spiel-UI (Client)
src/lib/content/ Content-Schema + Auflösung der Lösungsmengen
src/i18n/        Wörterbücher
```

## Rechtliches

Pokémon und alle zugehörigen Namen sind Marken von Nintendo, Creatures Inc. und GAME FREAK inc. Dieses Projekt ist nicht mit ihnen verbunden. Spieldaten stammen aus [PokéAPI](https://github.com/PokeAPI/pokeapi) (BSD-3-Clause).
