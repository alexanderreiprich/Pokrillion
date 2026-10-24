import { hasLocale } from "@/i18n/config";
import { playerId, readJson, respond } from "@/lib/server/http";
import { startRun } from "@/lib/server/endless";

/** Start a new endless run (abandons an open one). Body: { locale } */
export async function POST(request: Request) {
  return respond(async () => {
    const { locale } = await readJson(request);
    const lang = typeof locale === "string" && hasLocale(locale) ? locale : "de";
    return startRun(lang, await playerId({ create: true }));
  });
}
