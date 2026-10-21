import { parseUuid, playerId, respond } from "@/lib/server/http";
import { getRun } from "@/lib/server/endless";

export async function GET(_request: Request, ctx: RouteContext<"/api/v1/endless/[id]">) {
  return respond(async () => {
    const { id } = await ctx.params;
    return getRun(parseUuid(id), await playerId({ create: false }));
  });
}
