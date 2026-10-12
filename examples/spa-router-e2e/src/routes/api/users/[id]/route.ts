import type { RequestContext } from "lumiose";

let hits = 0;

/** User 3 is slow, so tests can watch a navigation hold the old page. `hits` counts the loads. */
export async function GET({ params }: RequestContext<"/api/users/[id]">): Promise<Response> {
  await new Promise((resolve) => setTimeout(resolve, params.id === "3" ? 800 : 20));
  return Response.json({ id: params.id, name: `User ${params.id}`, hits: ++hits });
}
