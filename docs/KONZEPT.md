# Pokrillion.io – Technisches Konzept

> *Eins zu einer Pokrillion.* Ein tägliches Pokémon-Trivia, bei dem seltene richtige Antworten mehr Punkte geben als offensichtliche.

Stand: 2026-10-21 · Status: Phase 1 lokal spielbar mit 99 aktiven Fragen; offen ist das Deployment

---

## 1. Produktidee

Pokrillion überträgt das Spielprinzip von [krillion.io](https://krillion.io/) ins Pokémon-Universum:

- **Jeden Tag 7 Fragen**, für alle Spieler dieselben („Nenne ein gelbes Pokémon“).
- **Viele Antworten sind richtig.** Wer *Pikachu* sagt, bekommt wenig Punkte. Wer *Lunastein* sagt, bekommt viele.
- **Pro Frage zählt eine richtige Antwort.** Falsche Versuche kosten Zeit, beenden die Frage aber nicht.
- **Am Ende:** Punktzahl, Statistik („12 % nannten Pikachu“) und ein teilbares Emoji-Ergebnis.

### Fragen-Kategorien (Medien)

| Kategorie | Kürzel | Beispiele |
|---|---|---|
| **Pokédex** (allgemein) | `pokedex` | Nenne ein gelbes Pokémon · ein Pokémon vom Typ Geist · ein legendäres Pokémon · ein Starter-Pokémon |
| **Spiele** | `games` | Nenne eine Höhle aus einem Pokémon-Spiel · eine Attacke vom Typ Feuer · einen Arenaleiter · ein Item aus dem Beutel |
| **Anime** | `anime` | Nenne einen Begleiter von Ash · ein Pokémon, das Ash gefangen hat · ein Mitglied von Team Rocket |
| *später:* TCG, Manga, Filme | `tcg` … | Nenne eine Karte aus dem Base Set |

Tagesmix (MVP): mindestens 3× Pokédex, mindestens 3× Spiele, der Rest wird frei verteilt. **Anime ist zurückgestellt** und kommt erst in Phase 2 mit einer eigenen Quote (≥ 1× pro Tag) in den Mix. Bis dahin sind Anime-Fragen inaktiv. Die Schwierigkeit steigt über die 7 Fragen leicht an.

---

## 2. Spielregeln (MVP)

| Regel | Wert | Anmerkung |
|---|---|---|
| Fragen pro Tag | 7 | „Pokrillion #N“, fortlaufend ab Starttag |
| Zeit pro Frage | 25 s | konfigurierbar pro Frage (`time_limit_s`) |
| Falsche Antwort | −3 s | gleiche falsche Eingabe zweimal kostet nichts extra |
| Antworten pro Frage | 1 richtige | die erste gültige Antwort ist final |
| Zeit abgelaufen | 0 Punkte | Stufe „Entkommen!“ |
| Autovervollständigung | **nein** | würde die Antworten verraten |
| Tageswechsel | lokale Mitternacht des Spielers | wie bei Wordle; Puzzles sind per Datum adressiert |
| Max. Punkte | 700 | 7 × 100 |

### Punkte-Stufen („Ball-Tiers“)

Krillion hat Stufen von *Plankton* bis *Krillion*. Bei Pokrillion sind es Pokébälle:

| Stufe (DE / EN) | Punkte | Bedeutung | Emoji |
|---|---|---|---|
| Entkommen! / Got away! | 0 | falsch oder Zeit abgelaufen | 💨 |
| Pokéball / Poké Ball | 10–20 | die offensichtliche Antwort | 🔴 |
| Superball / Great Ball | 25–45 | solide | 🔵 |
| Hyperball / Ultra Ball | 50–70 | selten | 🟡 |
| Shiny | 75–85 | sehr selten | ✨ |
| **Meisterball / Master Ball** | **100** | *die* Pokrillion-Antwort des Tages (kuratiert, 1 pro Frage) | 🟣 |

Die Meisterball-Antwort ist nicht einfach die seltenste. Sie wird kuratiert, wie bei Krillion: selten, aber eine, über die man sich freut („Ach, *das* ist gelb!“).

### Share-Text

```
Pokrillion #42 · 412/700
🔴🔵✨💨🟡🟣🔵
pokrillion.io
```

---

## 3. Punkte-Logik (Hybrid)

Die Seltenheit einer Antwort wird aus zwei Quellen geschätzt:

1. **Prior (Vorwissen):** Jede Entität hat einen **Bekanntheitswert** `familiarity ∈ [1, 100]`. Pikachu hat 100, Lunastein etwa 45.
2. **Beobachtung:** Wie oft wurde diese Antwort heute auf diese Frage tatsächlich gegeben?

### Formel

Für eine Frage mit der Menge gültiger Antworten `A`:

```
w(a)      = familiarity(a) ^ γ                 γ = 3.5   (macht Bekanntes „lauter“)
p0(a)     = w(a) / Σ w                          Prior-Anteil
share(a)  = (n(a) + K · p0(a)) / (N + K)        K = 30    (Prior zählt wie 30 virtuelle Spieler)
```

- `n(a)` = wie oft **andere** Spieler `a` heute für diese Frage genannt haben, `N` = Summe aller gültigen Antworten anderer Spieler heute auf diese Frage.
- Am Morgen (`N = 0`) gilt der reine Prior. Mit steigender Spielerzahl dominieren die echten Daten.

```
r       = clamp( log(S_hi / share) / log(S_hi / S_lo), 0, 1 )   S_hi = 0.25, S_lo = 0.002
points  = round_to_5( 10 + 75 · r )                            → 10 … 85
points  = 100, falls a die kuratierte Meisterball-Antwort ist
```

Ein Anteil von 25 % oder mehr ergibt 10 Punkte, ein Anteil von 0,2 % oder weniger ergibt 85 Punkte. Dazwischen verläuft die Kurve logarithmisch.

### Wichtige Eigenschaften

- **Punkte werden beim Absenden eingefroren.** Spätere Spieler verändern deine Punkte nicht. Dadurch ist die Punktzahl sofort final und teilbar.
- **Die eigene Antwort zählt nicht mit** („Wie viele andere haben das gesagt?“). Würde sie mitzählen, hätte am Morgen jede Antwort mindestens 1/(K+1) ≈ 3 % Anteil, und seltene Antworten kämen nie über 40 Punkte. `lock_answer` sperrt die Antwort atomar und liefert die Zählwerte; das Scoring zieht die eigene Antwort ab.
- **Kalibrierung (Stand 2026-10-21):** γ = 3,5 ergibt beim ersten Spieler z. B. Starter: Pikachu 10, Bisasam 20, seltene Starter 75–85. Bei „gelbes Pokémon“ bekommt Pikachu noch 25, weil die Heuristik allen Gen-1-Pokémon 70 gibt. Das löst sich über Familiarity-Overrides und echte Spielerdaten.
- **Lernen über Tage (Phase 2):** Wenn eine Frage nach Monaten wieder drankommt, fließen die alten Beobachtungen in den Prior ein. Der Prior-Anteil wird dann `(h(a) + K_h · p0(a)) / (H + K_h)`, mit `h` = historische Nennungen.
- Alle Konstanten (`γ`, `K`, `S_hi`, `S_lo`) liegen zentral in `src/lib/game/scoring.ts` und werden mit echten Daten feinjustiert.

### Woher kommt `familiarity`?

| Quelle | Wofür | Phase |
|---|---|---|
| Heuristik | Pokémon: Generation, Starter, legendär, Entwicklungsstufe | MVP (automatisch im Import) |
| Override-Dateien | handkuratierte Werte für Ikonen (Pikachu, Glurak, Mewtu …) | MVP |
| LLM-Vorschlag + Review | Bulk-Bewertung neuer Entitäten (Orte, Attacken, Charaktere), menschlich geprüft | Phase 1 |
| Spielerdaten | historische Nennhäufigkeit über alle Fragen | Phase 2 |

---

## 4. Antwort-Erkennung

Spieler tippen frei, ohne Autovervollständigung. Die Erkennung muss tolerant, aber nicht naiv sein.

### Pipeline

```
Eingabe → normalisieren → exakter Alias-Treffer? → Fuzzy-Treffer im Universum? → Ergebnis
```

1. **Normalisieren** (`src/lib/game/normalize.ts`): Kleinschreibung, Unicode NFKD und Akzente entfernen (`é → e`, `ü → u`), `ß → ss`, `♀/♂ → f/m`, alle Nicht-Alphanumerika entfernen. `"Mr. Mime"` wird so zu `mrmime`.
2. **Aliase:** Jede Entität hat Namen in DE und EN sowie optionale Aliase (z. B. `Nidoran weiblich`, `Nidoran female`, `Gary` für Blau). So zählt *Glurak* genauso wie *Charizard*.
3. **Universum statt nur Lösungsmenge:** Fuzzy-Matching läuft gegen **alle** Entitäten der passenden Art (z. B. alle 1025 Pokémon), nicht nur gegen die richtigen Antworten. Bei „Nenne ein Pokémon vom Typ Geist“ wird „Golbat“ deshalb als *Golbat → kein Geist* erkannt und nicht zum gültigen „Golbit“ (Golett) autokorrigiert, das nur einen Buchstaben entfernt ist.
4. **Fuzzy:** Damerau-Levenshtein (OSA). Erlaubte Distanz: Länge ≤ 4 → 0, Länge 5–7 → 1, Länge ≥ 8 → 2. Haben zwei verschiedene Entitäten dieselbe minimale Distanz, gilt die Eingabe als mehrdeutig und wird nicht gewertet. Ausnahme: Bei exakt gleichem Namen (z. B. Typ *Psycho* vs. Attacke) gewinnt die Entität, die gültig ist. Der Content-Build warnt vor solchen Kollisionen.
5. **Ergebnis:**
   - `valid`: richtige Antwort, mit Punkten
   - `wrong_entity`: bekannte Entität, aber falsch („Glurak ist nicht gelb.“). Kostet −3 s.
   - `unknown`: unbekannte Eingabe („Das kennt der Pokédex nicht.“). Kostet −3 s.
   - `duplicate_wrong`: dieselbe falsche Eingabe noch einmal, ohne Strafe

Unbekannte Eingaben werden geloggt. So findet die Kuratierung fehlende Aliase und vergessene richtige Antworten.

---

## 5. Architektur

```
┌──────────────────────────── Browser ────────────────────────────┐
│ Next.js App (React 19)  ·  Spielzustand + Streak in localStorage │
│ anonyme Spieler-ID (Cookie `pid`)                                │
└───────────────┬─────────────────────────────────────────────────┘
                │ HTTPS (Route Handlers /api/v1/*)
┌───────────────▼──────────────── Vercel ─────────────────────────┐
│ Next.js 16 App Router (Server Components, Route Handlers)        │
│  · Antwort-Matching + Scoring (server-seitig, Lösungen geheim)    │
│  · Tagesrätsel via `use cache` (cacheLife: hours)                 │
│  · Vercel Cron: Puzzle-Puffer auffüllen                          │
└───────────────┬─────────────────────────────────────────────────┘
                │ supabase-js (Service Role, nur server-seitig)
┌───────────────▼──────────────── Supabase ───────────────────────┐
│ Postgres: entities, aliases, questions, puzzles, plays, guesses  │
│ RLS an, keine Policies für anon → kein direkter Client-Zugriff   │
└─────────────────────────────────────────────────────────────────┘
                ▲
                │ npm run content:build / content:push
┌───────────────┴──────────────── Repo (Content as Code) ─────────┐
│ data/generated/*.json   ← npm run data:import (PokéAPI-CSVs)     │
│ content/questions/*.yaml  · content/entities/*.yaml              │
│ content/familiarity/*.yaml                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, Cache Components) | Fullstack-TypeScript, SSR für Teilen und SEO |
| Sprache | TypeScript (strict) | |
| Styling | **Tailwind CSS 4** + CSS-Variablen als Design-Tokens | wie Krillion |
| Fonts | `VT323` (UI, wie Krillion) + `Pixelify Sans` (Headlines) via `next/font/google` | Game-Boy-Retro-Gefühl |
| i18n | eigene Dictionaries + `app/[lang]` + `proxy.ts` | offizielles Next-16-Muster, keine Library nötig |
| DB | **Supabase Postgres** | Free Tier reicht; Auth ist später einfach nachrüstbar |
| Validierung | `zod` | Content-Schema und API-Payloads |
| Content | YAML im Repo (`yaml`) | reviewbar per Git-Diff |
| Tests | `vitest` | Spiellogik ist reine Funktionslogik |
| Scripts | `tsx` | Import, Build und Planung |
| Hosting | Vercel (Hobby) + Supabase (Free) | |

### Warum läuft das Matching auf dem Server?

- Die Lösungsmengen bleiben geheim (kein Spicken im JS-Bundle).
- Jede Eingabe wird geloggt. Daraus entstehen Statistiken und die Content-Pflege.
- Der Timer wird server-seitig geprüft (`question_started_at`).

---

## 6. Datenmodell (Postgres)

Vollständiges SQL: `supabase/migrations/20261021000000_init.sql`.

```
entities            Alles, was eine Antwort sein kann
  id text PK          'pokemon:pikachu', 'location:mt-moon', 'character:misty'
  kind text           pokemon | type | location | region | move | item | ability | character | game | team
  names jsonb         {"de": "Pikachu", "en": "Pikachu"}
  attrs jsonb         {"generation": 1, "color": "yellow", "types": ["electric"], …}
  familiarity int     1–100

entity_aliases      Normalisierte Suchbegriffe
  alias text, entity_id FK, lang text      PK(alias, entity_id)

questions           Fragen-Bank
  id text PK          'pokedex.color.yellow'
  category text       pokedex | games | anime
  prompt jsonb        {"de": "Nenne ein gelbes Pokémon", "en": "Name a yellow Pokémon"}
  answer_kinds text[] Universum fürs Fuzzy-Matching, z. B. {pokemon}
  difficulty int      1–5
  time_limit_s int    25
  masterball_entity_id FK
  active bool, cooldown_days int

question_answers    Lösungsmenge (vom Content-Build aufgelöst)
  question_id FK, entity_id FK, prior_share float    PK(question_id, entity_id)   Σ prior_share = 1

puzzles             Ein Tag = ein Puzzle
  puzzle_date date PK, number int unique

puzzle_questions
  puzzle_date FK, position 1–7, question_id FK       PK(puzzle_date, position)

plays               Ein Spieler spielt ein Puzzle (max. 1×)
  id uuid PK, puzzle_date FK, player_id uuid, locale, started_at, finished_at, total_score
  unique(puzzle_date, player_id)

play_questions      Fortschritt pro Frage (server-seitiger Timer)
  play_id FK, position, started_at, penalty_s, answered_at, entity_id, points, tier

guesses             Jede Eingabe (auch falsche)
  id bigint PK, play_id FK, position, raw_input, normalized, entity_id null, result, points, created_at
```

**Statistik:** Die View `puzzle_answer_counts(puzzle_date, position, entity_id, n)` zählt die gültigen Antworten. Sie liefert `n(a)` und `N` für das Scoring und die Auswertung am Ende.

**Antwort einloggen:** `lock_answer(play_id, position, entity_id)` setzt die Antwort atomar (nur wenn die Frage noch offen ist) und gibt `n` und `N` *inklusive* dieser Antwort zurück. Die Punkte berechnet danach `scoreAnswer()` in TypeScript, damit die Formel nur an einer Stelle existiert.

**Sicherheit:** RLS ist auf allen Tabellen aktiv, ohne Policies für `anon`/`authenticated`. Zugriff gibt es nur über die Next.js-Route-Handler mit Service-Role-Key (`server-only`).

---

## 7. API (Route Handlers, `/api/v1`)

| Methode & Pfad | Zweck | Antwort |
|---|---|---|
| `POST /play` `{date, locale}` | Spiel starten oder fortsetzen (setzt Cookie `pid`) | `{playId, number, questionCount, progress}` |
| `POST /play/:id/questions/:pos/start` | Frage aufdecken und Timer starten | `{prompt, category, timeLimitS, startedAt}` |
| `POST /play/:id/questions/:pos/guess` `{input}` | Antwort prüfen | `{result, entity?, points?, tier?, penaltyS, remainingS}` |
| `POST /play/:id/questions/:pos/timeout` | Zeit abgelaufen | `{tier: "miss"}` |
| `GET /play/:id/summary` | Auswertung nach der Runde | Punkte, Tiers, Top-Antworten pro Frage, Meisterball-Antworten, eigener Anteil |
| `GET /cron/schedule` | (Vercel Cron, `Authorization: Bearer $CRON_SECRET`) Puzzles 15 Tage im Voraus planen | `{created: [dates]}` |

Die Prompts werden **erst beim Start der Frage** ausgeliefert. Sonst könnte man alle 7 Fragen vorab googeln.

**Datum:** Der Client schickt sein lokales Datum. Der Server akzeptiert `UTC-heute ± 1 Tag` (Zeitzonen −12 bis +14).

---

## 8. Content-Pipeline („Content as Code“)

```
npm run data:import     PokéAPI-CSVs (GitHub) → data/generated/{pokemon,types,locations,moves,items,abilities}.json
npm run content:build   content/*.yaml + data/generated → validieren (zod) → Lösungsmengen auflösen
                        → supabase/seed.sql (lokal) bzw. build/content.json
npm run content:push    build/content.json → Supabase (Upsert via Service Role)          [Phase 1]
npm run schedule        Puzzles für die nächsten N Tage planen                           [Phase 1]
```

### Datenquellen

| Quelle | Inhalt | Lizenz/Hinweis |
|---|---|---|
| [PokéAPI-Daten (CSV)](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv) | Pokémon, Typen, Farben, Orte, Attacken, Items, Fähigkeiten, **DE/EN-Namen** | BSD-3; einmal laden und lokal cachen statt API-Spam |
| Bulbapedia / Pokéwiki (manuell) | Anime: Begleiter, Ash-Pokémon, Episoden; Arenaleiter etc. | Fakten werden kuratiert übernommen, keine Texte kopiert; Quelle wird pro Frage vermerkt |
| LLM-gestützt + Review | Bekanntheitswerte, Alias-Vorschläge, neue Fragen-Ideen | jede Ausgabe wird menschlich geprüft |

### Fragen-Format (YAML)

```yaml
- id: pokedex.color.yellow
  category: pokedex
  difficulty: 1
  prompt:
    de: Nenne ein gelbes Pokémon
    en: Name a yellow Pokémon
  answers:
    query: { kind: pokemon, where: { color: yellow } }   # automatisch aus PokéAPI-Daten
  masterball: pokemon:lunatone       # Lunastein – „Ach, der ist gelb?!“
  source: PokéAPI pokemon_colors

- id: pokedex.legendary
  …
  answers:
    query:                             # mehrere Queries = ODER
      - { kind: pokemon, where: { legendary: true } }
      - { kind: pokemon, where: { mythical: true } }

- id: games.location.cave
  …
  answers:
    query: { kind: location, nameMatches: "cave|cavern|grotto|höhle|grotte" }
    include: [location:mt-moon, location:rock-tunnel]   # Höhlen ohne „Höhle“ im Namen
    exclude: [location:hidden-grotto]                    # „Versteckte Lichtung“ ist keine Höhle

- id: anime.ash.companions
  category: anime
  difficulty: 2
  prompt:
    de: Nenne einen Reisebegleiter von Ash
    en: Name one of Ash's travelling companions
  answers:
    query: { kind: character, where: { roles: companion-ash } }   # aus content/entities/characters.yaml
  masterball: character:tracey
  source: https://bulbapedia.bulbagarden.net/wiki/Ash_Ketchum
```

### Fragen-Bestand (Stand 2026-10-21)

| Datei | Inhalt | Fragen |
|---|---|---|
| `pokedex-colors.yaml` | Pokédex-Farben | 10 |
| `pokedex-types.yaml` | Pokémon nach Typ | 18 |
| `pokedex-generations.yaml` | Pokémon nach Generation | 9 |
| `pokedex-forms.yaml` | Mega-, Regional-, Gigadynamax-Formen; Tausch- und Stein-Entwicklungen | 13 |
| `pokedex.yaml` | Legendäre, Starter, Babys, Evolis, Fossilien, Pseudo-Legendäre, Ultrabestien, Paradox | 8 |
| `games-moves.yaml` | Attacken nach Typ | 18 |
| `games-cities.yaml` | Städte und Dörfer pro Region (Kanto–Alola) | 7 |
| `games.yaml` | Höhlen, Regionen, Editionen, Teams, Items, Arenaleiter, Champs, Professoren | 19 |
| `anime.yaml` | zurückgestellt (inaktiv) | 2 |

Die Vorlagen-Dateien (`*-colors`, `*-types`, `*-generations`, `*-forms`, `*-moves`, `*-cities`) wurden einmalig per Script erzeugt und werden seitdem von Hand gepflegt. Die Lösungsmengen kommen über Queries aus den PokéAPI-Daten; der Import liefert dafür u. a. `forms` (mega/alola/galar/hisui/gmax), `evoItems` und `evoTrade` (jeweils für beide Seiten der Entwicklung). `idMatches` filtert z. B. Städte (`-(city|town|village)$`).

Meisterball-Antworten sind bewusst „Aha“-Antworten: Bisasam (Gift), Glurak (Flug), Relaxo (schwarz), Karpador (rot), Skaraborn (blau), Biss (Unlicht), Charme (Fee), Evoli bei Feuerstein.

**Planungsregeln für den Tagesmix:** Kategorie-Quoten wie in Abschnitt 1, keine zwei Fragen mit demselben `group` am selben Tag (z. B. nicht zweimal „Farbe“), Cooldown pro Frage (Standard 120 Tage), Schwierigkeit aufsteigend sortiert.

---

## 9. Design

### Vorbild Krillion (analysiert)

- Dunkle „Tiefsee“-Palette (`abyss #050a14`, `shallow #101d33`, `line #1b2c47`), Neon-Akzente (Cyan `#4de3ff`, Pink `#ff5d8f`)
- Pixelfont **VT323** für die gesamte UI, zentriertes Single-Column-Layout (`max-width ≈ 28rem`), mobil zuerst
- Eigene Farbe pro Tier, verspielte Microcopy („descending…“), Slide-out-Menü
- Easing mit Overshoot (`cubic-bezier(.34,1.56,.64,1)`) für knackige Reveals

### Pokrillion-Übertragung: „Nachts im hohen Gras“

| Element | Umsetzung |
|---|---|
| Palette | Nacht-/Höhlen-Blau `--night-950 #070b16`, `--night-900 #0f1830`, `--line #1f2c4d`; Akzente Pokéball-Rot `#ff3b4a`, Elektro-Gelb `#ffd23f`, Mondlicht-Cyan `#6fe7ff` |
| Tier-Farben | Pokéball `#ff6b6b`, Superball `#4d8dff`, Hyperball `#ffd23f`, Shiny `#7cf5d5`, Meisterball `#b26bff`, Entkommen `#4a5878` |
| Fonts | `VT323` für die UI, `Pixelify Sans` für Logo und Headlines |
| **Fragen-Box** | im Stil des klassischen Spiel-Dialogfensters: helle Box, doppelter Pixelrahmen, blinkender `▼`-Pfeil, Text tippt sich ein |
| **Timer = KP-Leiste** | grün → gelb → rot, wie die HP-Leiste im Kampf; bei −3 s „ruckelt“ sie |
| **Punkte = EP-Leiste** | füllt sich nach jeder Frage |
| Reveal | Ball-Wackeln (1–3×), dann „Gefangen!“ mit Tier-Farbe; beim Meisterball ein Glitzer-Effekt |
| Microcopy | „Ein wildes Quiz erscheint!“ (Laden) · „Gefangen!“ · „Mist! Es ist entkommen!“ · „Das kennt der Pokédex nicht.“ |
| Logo | Wortmarke „POKRILLION“ in Pixelfont, das „O“ als Pokéball; Tagline „eins zu einer Pokrillion“ |
| Grafiken | **keine offiziellen Artworks oder Sprites im MVP.** Pokébälle und Effekte als eigene SVG/CSS-Pixelgrafik |

---

## 10. Recht & Risiken

- **Markenrecht:** „Pokémon“ und alle Namen gehören Nintendo, Creatures Inc. und GAME FREAK. Pokrillion ist ein **inoffizielles, nicht-kommerzielles Fanprojekt**. Disclaimer im Footer, keine Werbung im MVP, keine offiziellen Logos oder Artworks.
- **Name/Domain:** „Pokrillion“ enthält „Pok“. Das Risiko ist gering, aber vorhanden. Bei Abmahnung braucht es einen Ausweichnamen.
- **Sprites:** Die PokéAPI-Sprites sind gerippte Spielgrafiken (Grauzone). Sie sind bewusst nicht im MVP.
- **Datenschutz:** nur eine anonyme Zufalls-ID, keine personenbezogenen Daten, kein Tracking-Cookie. Datenschutzhinweis und Impressum werden vor dem Go-live trotzdem nötig (DE).
- **Missbrauch:** Rate-Limit pro `pid`/IP auf `/guess`, ein Play pro `pid` und Tag. Cookie-Löschen erlaubt Mehrfachspielen. Das ist im MVP akzeptiert; Statistiken zählen nur abgeschlossene Plays.

---

## 11. Roadmap

### Phase 0 – Fundament ✅
- [x] Konzept
- [x] Next.js-16-Gerüst, Tailwind-Design-Tokens, Fonts, DE/EN-Routing
- [x] Spiellogik als reine Funktionen + Tests: Normalisierung, Matching, Scoring, Tiers, Share-Text, Puzzle-Nummer
- [x] DB-Schema (Supabase-Migration)
- [x] PokéAPI-Import-Script, Content-Schema, Beispiel-Fragen, Content-Build

### Phase 1 – Spielbarer MVP
- [x] Lokales Supabase (`npm run db:start`), `.env.local`
- [ ] Supabase-Cloud-Projekt anlegen
- [x] Server-Logik (`src/lib/server/`) + Route Handlers aus Abschnitt 7, server-seitiger Timer
- [x] Spiel-UI: Intro → 7× (Dialogbox mit Tipp-Effekt, KP-Timer, Eingabe, Ball-Wackeln) → Auswertung
- [x] Share-Button, Resume nach Reload (Fortschritt liegt auf dem Server), Serie über localStorage, Countdown zum nächsten Rätsel
- [x] Puzzle-Planer (`npm run schedule`) + Vercel Cron (`vercel.json`, täglich 03:00 UTC, 15 Tage Vorlauf)
- [ ] Rate-Limit auf `/guess` (vor öffentlichem Go-live)
- [x] Content: 99 aktive Fragen (55 Pokédex, 44 Spiele) + Familiarity-Overrides für ~180 Pokémon, 70 Attacken, 43 Items, 26 Orte
- [x] Footer mit Disclaimer (Impressum/Datenschutz erst bei öffentlichem Go-live)
- [ ] Deployment Vercel + Domain pokrillion.io

### Phase 2 – Wachstum
- Anime-Kategorie: Fragen kuratieren und prüfen (Begleiter, Ash-Pokémon …), Anime-Quote im Tagesmix aktivieren
- Archiv (vergangene Tage nachspielen), historischer Prior, Admin-/Review-Ansicht für unbekannte Eingaben
- Unlimited-Modus, Themen-Packs (z. B. „Nur Gen 1“), Accounts (Supabase Auth) + Freunde
- OG-Images fürs Teilen (`opengraph-image.tsx`), PWA

---

## 12. Projektstruktur

```
docs/KONZEPT.md                Dieses Dokument
content/
  questions/*.yaml             Fragen-Bank (pokedex, games, anime)
  entities/*.yaml              Kuratierte Entitäten (Anime-Charaktere, Höhlen …)
  familiarity/*.yaml           Bekanntheits-Overrides
data/
  pokeapi/                     CSV-Cache (gitignored)
  generated/*.json             Aus PokéAPI erzeugte Entitäten (committed, reviewbar)
scripts/                       data-import, content-build (tsx)
supabase/
  migrations/                  SQL-Schema
  seed.sql                     generiert von content:build
src/
  proxy.ts                     Sprach-Redirect / → /de bzw. /en
  app/[lang]/                  Seiten (layout, page, play …)
  app/api/v1/                  Route Handlers (Phase 1)
  i18n/                        Dictionaries + Locale-Helfer
  lib/game/                    Reine Spiellogik (+ *.test.ts)
  lib/content/                 Content-Schema (zod) + Loader
  lib/db/                      Supabase-Client (server-only, Phase 1)
```
