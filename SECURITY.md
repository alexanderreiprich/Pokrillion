# Sicherheit

Sicherheitslücken bitte **nicht** als Issue melden, sondern direkt an den Repo-Owner (@alexanderreiprich).

Relevant sind z. B. Wege, an die Lösungen einer Frage zu kommen, fremde Spielstände zu lesen oder zu ändern,
den Timer zu umgehen oder Zugriff auf die Datenbank zu erlangen.

## Schutzmaßnahmen im Repo

- Secrets gehören nur in `.env.local` (lokal) bzw. die Umgebungsvariablen von Vercel – nie ins Repo.
- `scripts/check-secrets.ts` läuft vor jedem Commit (Git-Hook) und in der CI.
- Details zu Branch-Schutz, CI und Dependabot: `docs/BRANCHING.md`.
