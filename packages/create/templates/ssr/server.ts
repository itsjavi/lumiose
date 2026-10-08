// Production server: serves the `lumen build` output (dist/) with @lumen/adapter-node. Static
// files come from dist/client; every other request goes to the app in dist/server/entry.js.
// Set PORT, HOST and ORIGIN as needed.
//
//   pnpm build && pnpm start
import { createServer } from "@lumen/adapter-node";

const { url } = await createServer({ dir: new URL("dist", import.meta.url) });
console.log(`Listening on ${url}`);
