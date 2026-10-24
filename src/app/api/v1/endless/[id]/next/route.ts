import { parseUuid, playerId, respond } from "@/lib/server/http";
import { nextQuestion } from "@/lib/server/endless";

/** Reveal the next random question (or resume the open one). */
export async function POST(_request: Request, ctx: RouteContext<"/api/v1/endless/[id]/next">) {
  return respond(async () => {
    const { id } = await ctx.params;
    return nextQuestion(parseUuid(id), await playerId({ create: false }));
  });
}
