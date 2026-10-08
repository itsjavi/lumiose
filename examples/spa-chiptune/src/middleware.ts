// Cross-origin isolation enables SharedArrayBuffer, which the audio engine uses to publish the
// playing row, levels and scope samples to the UI without messages. Without it, it falls back to
// postMessage. Same-origin scripts and the worklet need no extra headers.
import type { Middleware } from "lumen";

const middleware: Middleware = async (_ctx, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-embedder-policy", "require-corp");
  return new Response(response.body, { status: response.status, headers });
};

export default middleware;
