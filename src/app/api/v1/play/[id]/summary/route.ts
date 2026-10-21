import { parseUuid, playerId, respond } from "@/lib/server/http";
import { summary } from "@/lib/server/game";

/** End-of-round stats; only available once all questions are answered. */
export async function GET(_request: Request, ctx: RouteContext<"/api/v1/play/[id]/summary">) {
  return respond(async () => {
    const { id } = await ctx.params;
    return summary(parseUuid(id), await playerId({ create: false }));
  });
}
