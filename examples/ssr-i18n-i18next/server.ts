// Production server: serves the `lumiose build` output (dist/) with @lumiose/adapter-node. Static
// files come from dist/client (the prerendered /about and /es/about too); every other request goes
// to the app in dist/server/entry.js.
//
//   pnpm build && pnpm start
import { createServer } from "@lumiose/adapter-node";

const { url } = await createServer({ dir: new URL("dist", import.meta.url) });
console.log(`Listening on ${url}`);
