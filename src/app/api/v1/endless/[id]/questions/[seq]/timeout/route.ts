import { parsePosition, parseUuid, playerId, respond } from "@/lib/server/http";
import { timeoutEndless } from "@/lib/server/endless";

const MAX_SEQ = 1000;

/** Timer ran out: 0 points and one life less. */
export async function POST(_request: Request, ctx: RouteContext<"/api/v1/endless/[id]/questions/[seq]/timeout">) {
  return respond(async () => {
    const { id, seq } = await ctx.params;
    return timeoutEndless(parseUuid(id), await playerId({ create: false }), parsePosition(seq, MAX_SEQ));
  });
}
