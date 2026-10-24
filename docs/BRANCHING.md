# Branching & Releases

Repo: https://github.com/alexanderreiprich/Pokrillion

## Branches

| Branch | Bedeutung | Wie kommen Änderungen hinein |
|---|---|---|
| `prod` | Live-Stand (pokrillion.io) | nur per Pull Request: Release aus `staging` oder `hotfix/…` |
| `staging` | abgenommene Änderungen, noch nicht live (**Default-Branch**) | nur per Pull Request von Arbeits-Branches |
| `<präfix>/<kurzbeschreibung>` | eine Änderung in Arbeit | direkt pushen |

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

Namen: Kleinbuchstaben und Bindestriche, kurz und sprechend. Ausnahme: Dependabot legt eigene `dependabot/…`-Branches an.

## Schutzregeln

Das Repo ist privat und im kostenlosen GitHub-Plan. Dort gibt es **keinen serverseitigen Branch-Schutz** (Rulesets) und kein Secret Scanning. Diese Schutzschichten gelten stattdessen:

| Schutz | Wo | Wirkung |
|---|---|---|
| `.githooks/pre-push` | lokal | blockiert Pushes auf `prod`/`staging` (inkl. Löschen/Force-Push) – Änderungen nur per PR |
| `.githooks/pre-commit` | lokal | blockiert direkte Commits auf `prod`/`staging` und Commits mit Secrets oder `.env`-Dateien |
| CI `checks` | GitHub Actions, jeder PR + Push | Secret-Scan, Typecheck, Lint, Tests, Content-Validierung, Build |
| Dependabot | GitHub | Sicherheits-Alerts, automatische Security-PRs, wöchentliche Updates gegen `staging` |
| Actions-Richtlinie | GitHub | nur GitHub-eigene Actions, **SHA-Pinning erzwungen**, Workflow-Token nur mit Leserechten |
| Merge-Arten | GitHub | nur *Squash* und *Merge-Commit* (kein Rebase). Arbeits-Branches löscht `gh pr merge --delete-branch`; die automatische Löschung ist bewusst aus, weil sie bei Release-/Rückführungs-PRs `staging` oder `prod` löschen würde |

Die Hooks werden durch `npm install` aktiviert (`prepare` → `core.hooksPath`). Notfall-Override: `--no-verify`, nur bewusst verwenden.

**Wichtig, weil GitHub es nicht erzwingt:** Einen PR erst mergen, wenn `checks` grün ist. Mit GitHub Pro oder einem öffentlichen Repo lassen sich diese Regeln als Rulesets serverseitig erzwingen; die Vorlage steht unten.

### Später: Rulesets aktivieren (GitHub Pro oder öffentliches Repo)

Für `staging` und `prod` je ein Ruleset ohne Bypass, mit diesen Regeln:

- Pull Request erforderlich (0 Approvals, Review-Threads müssen gelöst sein)
- Status-Check `checks` erforderlich, Branch muss aktuell sein
- Löschen und Force-Push blockieren
- Erlaubte Merge-Arten: `staging` → Squash und Merge-Commit, `prod` → nur Merge-Commit

## Ablauf

```
feature/…, fix/…, content/…  ──PR (squash)──▶  staging  ──PR „Release“ (merge)──▶  prod
                                                  ▲                                   │
                                                  └────── PR (merge) ◀── Rückführung ─┤
hotfix/…  ─────────────────────────────── PR (merge) ────────────────────────────────▶┘
```

### 1. Änderung entwickeln

```bash
git switch staging && git pull
git switch -c feature/mein-feature
# … committen …
npm run typecheck && npm run lint && npm test
git push -u origin feature/mein-feature
gh pr create --base staging --fill
```

### 2. Abnehmen → `staging`

PR prüfen. **Erst wenn `checks` grün ist:** *Squash and merge*. Der PR-Titel wird zur Commit-Nachricht, deshalb Conventional-Commit-Format verwenden (z. B. `feat: Archiv`).

```bash
gh pr merge --squash --delete-branch
```

### 3. Release → `prod`

```bash
npx supabase migration list --linked        # neue Migrationen? dann zuerst:
npx supabase db push
gh pr create --base prod --head staging --title "release: v0.2.0" --body "…"
gh pr merge --merge                         # „Create a merge commit“ – OHNE --delete-branch!
git fetch && git tag -a v0.2.0 origin/prod -m "…" && git push origin v0.2.0   # optional
```

Nach dem Release ist `prod` inhaltlich identisch mit `staging`. GitHub kann Pull Requests nicht per Fast-Forward mergen, deshalb steht in `prod` zusätzlich ein Merge-Commit pro Release.

### 4. Hotfix (nur wenn es live brennt)

```bash
git switch prod && git pull && git switch -c hotfix/kurz
# … fixen, testen, committen, pushen …
gh pr create --base prod --fill && gh pr merge --merge
gh pr create --base staging --head prod --title "chore: Hotfix nach staging zurückführen"
gh pr merge --merge                         # Merge-Commit, NICHT squash
```

## Commit-Nachrichten

[Conventional Commits](https://www.conventionalcommits.org/de/), passend zu den Präfixen:
`feat:`, `fix:`, `refactor:`, `content:`, `chore:`, `docs:`, `test:`, `release:`. Beispiel: `content: Arenaleiter aus Kalos ergänzt`.

## Datenbank-Migrationen

- Neue Migrationen kommen mit dem Arbeits-Branch in `supabase/migrations/`.
- Der Zeitstempel im Dateinamen muss neuer sein als die letzte bereits angewendete Migration, sonst lehnt `supabase db push` sie ab.
- Neue Tabellen, Views und Funktionen bekommen explizit `grant … to service_role` (siehe Konzept §6, „Rechte“).
- Bisher gibt es nur eine Cloud-Datenbank (Prod). Migrationen werden **vor** dem Merge des Release-PRs angewendet (`npx supabase db push`), laufen also kurz neben dem alten Code. Deshalb nur additiv ändern; Umbauten in zwei Releases aufteilen.
- Migrationen nie nachträglich ändern, sondern eine neue Datei anlegen.

## Deployment

| Branch | Vercel | Supabase |
|---|---|---|
| `prod` | Production (Production Branch = `prod`), pokrillion.vercel.app | Cloud-Projekt (Free Tier) |
| `staging`, Arbeits-Branches | automatische Preview-URLs (hinter Vercel-Login) | keine eigene DB |

Sind die Supabase-Variablen in Vercel auch für *Preview* gesetzt, schreiben Previews in die Prod-Datenbank, und Spiele aus Previews zählen in die Statistik. Sonst funktionieren dort nur Seiten ohne DB-Zugriff.

Environment Variables in Vercel (alle nur server-seitig, nie mit `NEXT_PUBLIC_`):

| Variable | Wofür |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | DB-Zugriff |
| `CRON_SECRET` | schützt `/api/v1/cron/*`; Vercel Cron sendet es automatisch. Dient auch als Schlüssel für die IP-Hashes des Rate-Limits |
| `ADMIN_PASSWORD` | Kuratierungsansicht `/admin`; leer = Ansicht deaktiviert |

Vercel Cron (`vercel.json`) läuft nur auf Production, täglich 03:00 UTC. Nach einem frischen Setup einmal von Hand auslösen, damit sofort Rätsel da sind: `curl -H "Authorization: Bearer $CRON_SECRET" https://pokrillion.vercel.app/api/v1/cron/schedule`.

**Geplant:** eigene Domain pokrillion.io, später ein getrenntes Staging-Projekt in Supabase.
