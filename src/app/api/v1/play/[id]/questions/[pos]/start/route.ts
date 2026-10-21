import { QUESTIONS_PER_PUZZLE } from "@/lib/game/puzzle-date";
import { parsePosition, parseUuid, playerId, respond } from "@/lib/server/http";
import { startQuestion } from "@/lib/server/game";

/** Reveal a question and start its timer (or resume it). */
export async function POST(_request: Request, ctx: RouteContext<"/api/v1/play/[id]/questions/[pos]/start">) {
  return respond(async () => {
    const { id, pos } = await ctx.params;
    return startQuestion(parseUuid(id), await playerId({ create: false }), parsePosition(pos, QUESTIONS_PER_PUZZLE));
  });
}
