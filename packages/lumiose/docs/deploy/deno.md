# Deno

> Run a Lumiose build with Deno: `deno serve` serves `dist/server/entry.js`'s `{ fetch }` as it is, static files included.

Tested locally with Deno 2.9.6: see the [verification table](README.md#verification).

## Run it

Build with Node (Deno reads the project's `package.json` and `node_modules`), then serve the server
build from the project directory:

```sh
pnpm lumiose build
deno serve --allow-net --allow-read --allow-env --port 3000 dist/server/entry.js
```

`--allow-read` covers `dist/client` and `node_modules`, `--allow-env` the environment that
`env()` and `ctx.env` read. The handler serves the static files of `dist/client` (with their
`.br`/`.gz` copies, `ETag`s and a year of caching for content-hashed assets), then the app, with
`lumiose({ headers })`. `ctx.platform.clientAddress` is the handler info's
`remoteAddr.hostname`. The app's responses were not compressed in the local tests (streamed pages
included): put a proxy or CDN that compresses in front ([VPS](vps.md#the-proxy)).

**Deno Deploy** runs modules that export `{ fetch }`, but it is not tested: the server build
imports npm packages from `node_modules` and reads `dist/client` from disk, which a deployment must
include.

See also: [the server build](../reference/server-entry.md).
