import { playerId, respond } from "@/lib/server/http";
import { currentRun } from "@/lib/server/endless";

/** The player's open run, or null. */
export async function GET() {
  return respond(async () => currentRun(await playerId({ create: true })));
}
