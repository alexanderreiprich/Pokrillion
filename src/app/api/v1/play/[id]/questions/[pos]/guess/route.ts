import { QUESTIONS_PER_PUZZLE } from "@/lib/game/puzzle-date";
import { ApiError, parsePosition, parseUuid, playerId, readJson, respond } from "@/lib/server/http";
import { submitGuess } from "@/lib/server/game";

/** Body: { input: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/play/[id]/questions/[pos]/guess">) {
  return respond(async () => {
    const { id, pos } = await ctx.params;
    const { input } = await readJson(request);
    if (typeof input !== "string") throw new ApiError("bad_request", "input fehlt");
    return submitGuess(
      parseUuid(id),
      await playerId({ create: false }),
      parsePosition(pos, QUESTIONS_PER_PUZZLE),
      input,
    );
  });
}
