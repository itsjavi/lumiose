import type { Server } from "node:http";
import lumiose from "@lumiose/vite";
import { handleUpgrade } from "./src/server/chat-socket.server.ts";

/** In dev, the chat's WebSockets attach to Vite's server; other upgrades (HMR) stay Vite's. */
function chatSockets() {
  return {
    name: "chat-sockets",
    configureServer(server: { httpServer: Server | null }) {
      server.httpServer?.on("upgrade", (request, socket, head) => {
        handleUpgrade(request, socket, head);
      });
    },
  };
}

export default {
  // Pages are prerendered; the endpoints render per request.
  plugins: [lumiose(), chatSockets()],
};
