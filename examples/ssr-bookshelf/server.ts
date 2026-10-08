// Production server: serves the `lumen build` output (dist/) with @lumen/adapter-node.
// Static files (prerendered pages, assets) come from dist/client; every other request goes to the
// app's handler in dist/server/entry.js. Set LUMEN_SECRET (and PORT, HOST, ORIGIN as needed).
//
//   pnpm build && LUMEN_SECRET=… pnpm start
import { createServer } from "@lumen/adapter-node";

const { url } = await createServer({ dir: new URL("dist", import.meta.url) });
console.log(`Bookshelf listening on ${url}`);
