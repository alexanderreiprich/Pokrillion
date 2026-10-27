import { ApiError, parsePosition, parseUuid, playerId, readJson, respond } from "@/lib/server/http";
import { submitEndlessGuess } from "@/lib/server/endless";
import { limitGuesses } from "@/lib/server/rate-limit";

const MAX_SEQ = 1000;

/** Body: { input: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/endless/[id]/questions/[seq]/guess">) {
  return respond(async () => {
    const { id, seq } = await ctx.params;
    const { input } = await readJson(request);
    if (typeof input !== "string") throw new ApiError("bad_request", "input fehlt");
    const player = await playerId({ create: false });
    return submitEndlessGuess(
      parseUuid(id),
      player,
      parsePosition(seq, MAX_SEQ),
      input,
      limitGuesses(request.headers, player),
    );
  });
}
