# Branching & Releases

## Branches

| Branch | Bedeutung | Wer schreibt darauf |
|---|---|---|
| `prod` | Live-Stand (pokrillion.io) | nur Releases aus `staging` und Hotfixes |
| `staging` | abgenommene Änderungen, noch nicht live | nur Merges von Arbeits-Branches |
| `<präfix>/<kurzbeschreibung>` | eine Änderung in Arbeit | du |

Direkte Commits auf `prod` und `staging` blockiert der Hook in `.githooks/pre-commit`. Er wird durch `npm install` aktiviert (`prepare`-Script → `core.hooksPath`).

### Präfixe für Arbeits-Branches

| Präfix | Wofür | Beispiel |
|---|---|---|
| `feature/` | neue Funktion | `feature/archive` |
| `fix/` | Fehlerbehebung (über `staging`) | `fix/timer-after-reload` |
| `hotfix/` | dringender Fix direkt für `prod` | `hotfix/guess-500` |
| `refactor/` | Umbau ohne Verhaltensänderung | `refactor/split-game-service` |
| `content/` | Fragen, Entitäten, Bekanntheitswerte | `content/kalos-gym-leaders` |
| `chore/` | Abhängigkeiten, Tooling, Config | `chore/update-next` |
| `docs/` | nur Dokumentation | `docs/deployment` |
| `test/` | nur Tests | `test/summary-api` |

Namen: Kleinbuchstaben und Bindestriche, kurz und sprechend.

## Ablauf

```
feature/…  ──squash──▶  staging  ──fast-forward──▶  prod
fix/…      ──squash──▶     ▲                          │
content/…  ──squash──▶     └──────── merge ◀──────────┤
                                                       │
hotfix/…   ──────────────────────── merge --no-ff ───▶┘
```

### 1. Änderung entwickeln

```bash
git switch staging && git pull            # sobald es ein Remote gibt
git switch -c feature/mein-feature
# … committen (beliebig viele Commits) …
npm run typecheck && npm run lint && npm test
```

### 2. Abnehmen → `staging`

```bash
git switch staging
git merge --squash feature/mein-feature
git commit -m "feat: kurze Beschreibung"   # ein Commit pro Änderung
git branch -D feature/mein-feature
```

Mit GitHub läuft das als Pull Request mit „Squash and merge“.

### 3. Release → `prod`

```bash
git switch prod
git merge --ff-only staging                # prod = exakt ein getesteter staging-Stand
git tag -a v0.2.0 -m "…"                   # optional, empfohlen
```

`--ff-only` stellt sicher, dass `prod` nie Commits enthält, die nicht vorher auf `staging` waren. Schlägt es fehl, wurde `prod` per Hotfix geändert: zuerst Schritt 4b nachholen.

### 4. Hotfix (nur wenn es live brennt)

```bash
git switch prod && git switch -c hotfix/kurz
# … fixen, testen, committen …
git switch prod && git merge --no-ff hotfix/kurz      # 4a
git switch staging && git merge prod                  # 4b: Fix zurück nach staging
git branch -d hotfix/kurz
```

## Commit-Nachrichten

[Conventional Commits](https://www.conventionalcommits.org/de/), passend zu den Präfixen:
`feat:`, `fix:`, `refactor:`, `content:`, `chore:`, `docs:`, `test:`. Beispiel: `content: Arenaleiter aus Kalos ergänzt`.

## Datenbank-Migrationen

- Neue Migrationen kommen mit dem Arbeits-Branch in `supabase/migrations/`.
- Sie werden zuerst auf die Staging-Datenbank angewendet und erst mit dem Release auf Prod.
- Migrationen nie nachträglich ändern, sondern eine neue Datei anlegen.

## Deployment (geplant, siehe Konzept §11)

| Branch | Vercel | Supabase |
|---|---|---|
| `prod` | Production (Production Branch = `prod`), pokrillion.io | Projekt `pokrillion-prod` |
| `staging` | Preview mit fester Domain, z. B. staging.pokrillion.io | Projekt `pokrillion-staging` |
| Arbeits-Branches | automatische Preview-URLs | Staging-DB |

Vercel Cron läuft nur auf Production. Für Staging plant man Rätsel per `npm run schedule` mit den Staging-Zugangsdaten.
