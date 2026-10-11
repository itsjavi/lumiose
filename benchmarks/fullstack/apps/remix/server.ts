import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.ts";

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 4107;
// Under `hmr.ts` (development), the app runs behind its proxy.
const isHmr = process.env.REMIX_NODE_HMR === "1";

const server = http.createServer(createRequestListener(router.fetch, { trustProxy: isHmr }));

server.listen(port, "127.0.0.1", () => {
  if (isHmr) {
    void import("remix/node-hmr/runtime").then((nodeHmr) => nodeHmr.emitServerReady());
  }
  console.log(`Server listening on http://127.0.0.1:${port}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => process.exit(0));
  server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
