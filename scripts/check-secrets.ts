/**
 * Free stand-in for GitHub secret scanning (not available for private repos on the free plan).
 *
 *   node scripts/check-secrets.ts            scan all tracked files (CI)
 *   node scripts/check-secrets.ts --staged   scan staged changes (pre-commit hook)
 *
 * A line can be allowed explicitly with the comment `check-secrets: allow`.
 * Runs with plain Node 24 (type stripping) – no imports from the app, no dependencies.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export interface Finding {
  path: string;
  line: number;
  rule: string;
  excerpt: string;
}

const RULES: { rule: string; pattern: RegExp }[] = [
  { rule: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { rule: "JWT (z. B. Supabase service_role/anon key)", pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { rule: "GitHub token", pattern: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { rule: "Anthropic/OpenAI API key", pattern: /\bsk-(ant-)?[A-Za-z0-9_-]{30,}/ },
  { rule: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: "Postgres URL mit Passwort", pattern: /postgres(ql)?:\/\/[^:\s/]+:(?!postgres@)[^@\s]{6,}@/ },
  {
    rule: "Secret-Variable mit Wert",
    pattern: /^\s*(export\s+)?[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|SERVICE_ROLE_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*["']?[^\s"'#]{8,}/,
  },
];

/** Files that must never be committed, whatever they contain. */
const FORBIDDEN_FILES = [/(^|\/)\.env($|\.(?!example$)[^/]*$)/, /\.(pem|p12|pfx|key)$/];

const ALLOW_MARKER = "check-secrets: allow";

function mask(s: string): string {
  return s.length <= 12 ? "***" : `${s.slice(0, 8)}…${s.slice(-3)}`;
}

export function findSecrets(path: string, text: string): Finding[] {
  const findings: Finding[] = [];
  if (FORBIDDEN_FILES.some((re) => re.test(path))) {
    findings.push({ path, line: 0, rule: "Datei darf nicht ins Repo", excerpt: path });
  }
  const lines = text.split("\n");
  lines.forEach((content, i) => {
    if (content.includes(ALLOW_MARKER)) return;
    for (const { rule, pattern } of RULES) {
      const match = content.match(pattern);
      if (match) findings.push({ path, line: i + 1, rule, excerpt: mask(match[0]) });
    }
  });
  return findings;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function isBinary(text: string): boolean {
  return text.includes("\u0000");
}

function main() {
  const staged = process.argv.includes("--staged");
  const paths = (
    staged ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]) : git(["ls-files", "-z"])
  )
    .split("\u0000")
    .filter(Boolean);

  const findings: Finding[] = [];
  for (const path of paths) {
    // Staged mode reads the index, so unstaged edits can't hide or fake anything.
    if (!staged && !existsSync(path)) continue; // deleted in the working tree
    const text = staged ? git(["show", `:${path}`]) : readFileSync(path, "utf8");
    if (isBinary(text)) continue;
    findings.push(...findSecrets(path, text));
  }

  if (findings.length === 0) {
    if (!staged) console.log(`✓ Keine Secrets in ${paths.length} Dateien gefunden.`);
    return;
  }
  console.error("✗ Mögliche Secrets gefunden – nicht committen:");
  for (const f of findings) console.error(`  ${f.path}${f.line ? `:${f.line}` : ""}  ${f.rule}  (${f.excerpt})`);
  console.error(`\n  Echte Secrets gehören in .env.local bzw. die Umgebungsvariablen von Vercel/GitHub.`);
  console.error(`  Falsch-positiv? Zeile mit dem Kommentar „${ALLOW_MARKER}“ markieren.`);
  process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/check-secrets.ts")) main();
