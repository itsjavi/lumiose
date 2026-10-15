// One measurement of the large-app benchmark in a process of its own (TASK-319), with the Lumiose
// build that `<app>/node_modules` links (scripts/ab.ts sets it up). Prints one JSON line.
//
//   node runner.ts build <app>   { "ms" }: process start to the end of `lumiose build`
//   node runner.ts dev <app>     { "url" }: `lumiose dev` listening; runs until stdin ends
//   node runner.ts serve <app>   { "url" }: the build served by @lumiose/adapter-node; on a "stop"
//                                line, { "peakRssMb", "rssMb" } (resident memory, peak and after GC)
import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const [command, app] = process.argv.slice(2);
if (app === undefined) {
  console.error("Usage: node runner.ts build|dev|serve <app>");
  process.exit(2);
}

/** Imports a module as the app resolves it: from the Lumiose build its node_modules links. */
const require = createRequire(join(app, "package.json"));
const load = async <T>(specifier: string): Promise<T> =>
  (await import(pathToFileURL(require.resolve(specifier)).href)) as T;

/** Megabytes, one decimal. */
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
const send = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`);
const lines = () => createInterface({ input: process.stdin });

switch (command) {
  case "build": {
    process.env.NODE_ENV ??= "production";
    const { build } = await load<{ build(options: object): Promise<unknown> }>(
      "@lumiose/vite/build",
    );
    await build({ root: app, logLevel: "silent" });
    send({ ms: performance.now() });
    break;
  }
  case "dev": {
    const { createDevServer } = await load<{
      createDevServer(options: object): Promise<{ url: string; close(): Promise<void> }>;
    }>("@lumiose/vite/dev");
    const server = await createDevServer({ root: app, port: 0, logLevel: "silent" });
    send({ url: server.url });
    for await (const _ of lines()) {
      // Nothing to answer: the parent ends stdin to stop the server.
    }
    await server.close();
    process.exit(0);
    break;
  }
  case "serve": {
    const { createHandler } = await load<{
      createHandler(options: object): Promise<(req: unknown, res: unknown) => void>;
    }>("@lumiose/adapter-node");
    const handler = await createHandler({ dir: join(app, "dist") });
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    let peak = process.memoryUsage.rss();
    const sampler = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage.rss());
    }, 10);
    send({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    for await (const line of lines()) {
      if (line !== "stop") continue;
      clearInterval(sampler);
      peak = Math.max(peak, process.memoryUsage.rss());
      globalThis.gc?.();
      send({ peakRssMb: mb(peak), rssMb: mb(process.memoryUsage.rss()) });
      server.close();
      process.exit(0);
    }
    break;
  }
  default:
    console.error(`Unknown command ${command}`);
    process.exit(2);
}
