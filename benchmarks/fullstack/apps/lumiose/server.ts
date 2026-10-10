// Production server: the `lumiose build` output (dist/) served by @lumiose/adapter-node on port 4101.
// Compression is off, as in every app of the benchmark (doc-4 §1): payloads are measured offline.
import { createServer } from "@lumiose/adapter-node";

const { url } = await createServer({
  dir: new URL("dist", import.meta.url),
  port: Number(process.env.PORT ?? 4101),
  compress: false,
});
console.log(`Tracker (Lumiose) listening on ${url}`);
