// Production server: Express serving the build with React Router's request handler.
// Equivalent to `react-router-serve` minus its compression and request-logging middleware
// (doc-4 §1: HTTP compression is off in every app).
import { createRequestHandler } from "@react-router/express";
import express from "express";
import type { ServerBuild } from "react-router";

const port = Number(process.env.PORT ?? 4102);
const build = (await import(
  new URL("./build/server/index.js", import.meta.url).href
)) as ServerBuild;

const app = express();
app.disable("x-powered-by");
// Fingerprinted assets are immutable; everything else in build/client gets a short cache.
app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.all("*splat", createRequestHandler({ build, mode: process.env.NODE_ENV }));

app.listen(port, () => console.log(`React Router Tracker on http://localhost:${port}`));
