// Production server: the `lumen build` output (dist/) served by @lumen/adapter-node on port 4101.
// It does not compress responses, like every app of the benchmark (doc-4 §1).
import { createServer } from "@lumen/adapter-node";

const { url } = await createServer({
  dir: new URL("dist", import.meta.url),
  port: Number(process.env.PORT ?? 4101),
});
console.log(`Tracker (Lumen) listening on ${url}`);
