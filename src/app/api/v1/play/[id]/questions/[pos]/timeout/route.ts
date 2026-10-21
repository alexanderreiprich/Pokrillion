import { QUESTIONS_PER_PUZZLE } from "@/lib/game/puzzle-date";
import { parsePosition, parseUuid, playerId, respond } from "@/lib/server/http";
import { timeoutQuestion } from "@/lib/server/game";

/** The timer ran out on the client (or the player gave up): 0 points. */
export async function POST(_request: Request, ctx: RouteContext<"/api/v1/play/[id]/questions/[pos]/timeout">) {
  return respond(async () => {
    const { id, pos } = await ctx.params;
    return timeoutQuestion(parseUuid(id), await playerId({ create: false }), parsePosition(pos, QUESTIONS_PER_PUZZLE));
  });
}
