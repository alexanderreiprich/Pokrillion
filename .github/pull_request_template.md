## Was ändert sich?

<!-- Kurz: was und warum. -->

## Checkliste

- [ ] Branch-Präfix passt (`feature/`, `fix/`, `hotfix/`, `refactor/`, `content/`, `chore/`, `docs/`, `test/`)
- [ ] Ziel-Branch: `staging` (nur Releases und Hotfixes gehen nach `prod`)
- [ ] Neue UI-Texte in `de.json` **und** `en.json`
- [ ] Bei Content: `npm run content:build` ohne ✗, Warnungen (⚠) geprüft
- [ ] Bei Schemaänderung: neue Datei in `supabase/migrations/` (bestehende nie ändern)
- [ ] `docs/KONZEPT.md` aktualisiert, falls sich Entscheidungen geändert haben
