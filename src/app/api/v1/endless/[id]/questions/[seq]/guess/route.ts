import { ApiError, parsePosition, parseUuid, playerId, readJson, respond } from "@/lib/server/http";
import { submitEndlessGuess } from "@/lib/server/endless";

const MAX_SEQ = 1000;

/** Body: { input: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/endless/[id]/questions/[seq]/guess">) {
  return respond(async () => {
    const { id, seq } = await ctx.params;
    const { input } = await readJson(request);
    if (typeof input !== "string") throw new ApiError("bad_request", "input fehlt");
    return submitEndlessGuess(parseUuid(id), await playerId({ create: false }), parsePosition(seq, MAX_SEQ), input);
  });
}
