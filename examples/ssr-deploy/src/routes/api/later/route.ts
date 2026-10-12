// waitUntil(): work that finishes after the response. A second request reads its result, while
// the same instance serves it (emulators run one).
import type { Endpoint } from "lumiose";

export const mode = "server";

const done = new Set<string>();

export const GET: Endpoint<"/api/later"> = (ctx) => {
  const id = ctx.url.searchParams.get("id") ?? "";
  if (ctx.url.searchParams.has("check")) return Response.json({ done: done.has(id) });
  ctx.platform.waitUntil(
    new Promise<void>((resolve) =>
      setTimeout(() => {
        done.add(id);
        resolve();
      }, 200),
    ),
  );
  return Response.json({ started: id });
};
