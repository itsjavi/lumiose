// Production server: @lumiose/adapter-node serves the `lumiose build` output, and the chat's
// WebSockets attach to the same `node:http` server through its `upgrade` event.
//
//   pnpm build && pnpm start
import { createServer } from "@lumiose/adapter-node";
import { closeChat, handleUpgrade } from "./src/server/chat-socket.server.ts";

const app = await createServer({ dir: new URL("dist", import.meta.url) });

app.server.on("upgrade", (request, socket, head) => {
  // Not the chat's path: no other handler, so refuse it.
  if (!handleUpgrade(request, socket, head)) socket.destroy();
});

process.once("SIGTERM", () => {
  closeChat();
  void app.close();
});

console.log(`Listening on ${app.url}`);
