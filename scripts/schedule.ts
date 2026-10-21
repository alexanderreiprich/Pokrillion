/**
 * Plans daily puzzles (needs .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 *   npm run schedule                      today (UTC − 1 day) + 14 days
 *   npm run schedule -- --from 2026-11-01 --days 30
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { formatIsoDate } from "../src/lib/game/puzzle-date";
import { ensureSchedule } from "../src/lib/schedule-runner";

const ROOT = path.resolve(import.meta.dirname, "..");
const envFile = path.join(ROOT, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen (.env.local)");

  // Start one day back: west of UTC it may still be "yesterday".
  const from = arg("from") ?? formatIsoDate(Date.now() - 24 * 60 * 60 * 1000);
  const days = Number(arg("days") ?? 15);

  const client = createClient(url, key, { auth: { persistSession: false } });
  const created = await ensureSchedule(client, from, days);
  if (created.length === 0) console.log(`Alles schon geplant (${from} + ${days} Tage).`);
  for (const p of created) console.log(`✓ ${p.date} #${p.number}: ${p.questions.join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
