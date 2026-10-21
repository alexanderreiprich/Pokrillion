@AGENTS.md

# Pokrillion – Projektregeln

Tägliches Pokémon-Trivia nach dem Vorbild von krillion.io. **Konzept, Architektur, Datenmodell und Roadmap: `docs/KONZEPT.md`.** Lies es vor größeren Änderungen und halte es aktuell, wenn Entscheidungen sich ändern.

## Befehle

- `npm test`: Vitest (Spiellogik). `npm run typecheck`, `npm run lint`
- `npm run data:import`: PokéAPI → `data/generated/*.json`
- `npm run content:build`: Content validieren → `build/content.json` + `supabase/seed.sql` (generiert, nie von Hand editieren)
- Nach Änderungen an `content/` immer `content:build` laufen lassen. Fehler (✗) brechen ab, Warnungen (⚠) prüfen.
- `npm run db:reset`: lokale DB neu (Content-Build + Migrationen + Seed; löscht Spiele und Planung), danach `npm run schedule`
- Lokales Supabase: `npm run db:start` (Docker Desktop muss laufen), Studio auf http://127.0.0.1:54323

## Git

- Branching-Strategie: `docs/BRANCHING.md`. `prod` = live, `staging` = abgenommen, Arbeit auf `feature/`, `fix/`, `hotfix/`, `refactor/`, `content/`, `chore/`, `docs/`, `test/`.
- Nie direkt auf `prod` oder `staging` committen (Hook blockiert das); immer erst einen Arbeits-Branch von `staging` anlegen.
- Commit-Nachrichten nach Conventional Commits (`feat:`, `fix:`, `content:`, …). Änderungen kommen per Pull Request (`gh pr create --base staging`); PRs mergen oder Releases nach `prod` nur, wenn der User es sagt.
- CI-Check `checks` (`.github/workflows/ci.yml`) muss grün sein, bevor ein PR gemergt wird – den Job-Namen nicht ändern. Actions nur mit Commit-SHA pinnen (GitHub erzwingt das).

## Konventionen

- UI-Texte nur über `src/i18n/dictionaries/{de,en}.json`, immer beide Sprachen pflegen.
- Spiellogik bleibt als reine Funktionen in `src/lib/game/` (kein I/O) mit Tests in `*.test.ts`.
- Scoring-Konstanten stehen nur in `src/lib/game/scoring.ts`. Die DB liefert Zählwerte, Punkte rechnet TypeScript.
- Lösungsmengen und Matching laufen nur server-seitig. Antworten dürfen nie ins Client-Bundle.
- Route Handler unter `src/app/api/v1/` bleiben dünn; die Logik steckt in `src/lib/server/game.ts`. JSON-Verträge: `src/lib/api/types.ts`.
- Client-Komponenten: kein `Date.now()`/`Math.random()` im Render (React-Compiler-Lint), Zeit über `useNow()`.
- DB-Zugriff nur über `src/lib/db/server.ts` (Service Role). RLS ist überall an, ohne Policies.
- Entity-IDs haben die Form `<kind>:<slug>` (`pokemon:pikachu`). Neue Entity-Arten in `ENTITY_KINDS` eintragen.
- Design-Tokens stehen in `src/app/globals.css` (`@theme`). Keine offiziellen Pokémon-Artworks oder Sprites einbinden (siehe Konzept §10).
- Schemaänderungen nur als neue Datei in `supabase/migrations/`.
