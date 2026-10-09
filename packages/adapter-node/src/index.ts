// `@lumen/adapter-node`: serve a `lumen build` output with Node (spec §8 Build, "Adapters").
//
//   import { createServer } from "@lumen/adapter-node";
//   const { url } = await createServer({ port: 3000 }); // serves ./dist
export { createHandler, createServer } from "./server.ts";
export type { HandlerOptions, LumenServer, NodeHandler, ServerOptions } from "./server.ts";
export { createStaticHandler } from "./static.ts";
export type { StaticHandler, StaticOptions } from "./static.ts";
