// One server for dev and production (decision-52): `node server.ts --dev` mounts the app through
// `createDevHandler()` from @lumiose/vite/dev (HMR, the error overlay, server-only reloads), and
// `node server.ts` serves the `lumiose build` output with @lumiose/adapter-node. The chat's
// WebSockets attach to the same `node:http` server through its `upgrade` event in both.
//
//   pnpm dev                  # node server.ts --dev
//   pnpm build && pnpm start  # node server.ts
import { createServer } from "node:http";
import { createHandler } from "@lumiose/adapter-node";
import { closeChat, handleUpgrade } from "./src/server/chat-socket.server.ts";

const dev = process.argv.includes("--dev");
const server = createServer();
// @lumiose/vite is a dev dependency: production never loads it.
const devHandler = dev
  ? await (await import("@lumiose/vite/dev")).createDevHandler({ server })
  : undefined;
server.on(
  "request",
  devHandler ?? (await createHandler({ dir: new URL("dist", import.meta.url) })),
);

server.on("upgrade", (request, socket, head) => {
  if (handleUpgrade(request, socket, head)) return;
  // Not the chat's path. In dev, Vite's HMR upgrades on this server too: leave it alone.
  if (!dev) socket.destroy();
});

process.once("SIGTERM", () => {
  closeChat();
  server.close();
  void devHandler?.close();
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST;
server.listen(port, host, () => {
  console.log(`Listening on http://${host ?? "localhost"}:${port}/${dev ? " (dev)" : ""}`);
});
