// Production server: serves the `lumiose build` output (dist/) with @lumiose/adapter-node. Static
// files come from dist/client; every other request goes to the app in dist/server/entry.js.
// Set BETTER_AUTH_SECRET, BETTER_AUTH_URL and DATABASE_URL (and PORT, HOST, ORIGIN as needed),
// and apply the migrations first (`pnpm db:migrate`).
//
//   pnpm build && pnpm db:migrate && pnpm start
import { createServer } from "@lumiose/adapter-node";

const { url } = await createServer({ dir: new URL("dist", import.meta.url) });
console.log(`Listening on ${url}`);
