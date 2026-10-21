import { hasLocale } from "@/i18n/config";
import { ApiError, playerId, readJson, respond } from "@/lib/server/http";
import { startPlay } from "@/lib/server/game";

/** Start or resume today's round. Body: { date: "YYYY-MM-DD" (player's local date), locale } */
export async function POST(request: Request) {
  return respond(async () => {
    const { date, locale } = await readJson(request);
    if (typeof date !== "string") throw new ApiError("bad_request", "date fehlt");
    const lang = typeof locale === "string" && hasLocale(locale) ? locale : "de";
    return startPlay(date, lang, await playerId({ create: true }));
  });
}
