# Deno

> Run a Lumiose build with Deno: `deno serve` runs the server build's fetch handler and serves the static files as they are.

> **Status:** Tested locally with Deno 2.9.6 ([verification table](README.md#verification)).

## 1. Build

```sh
pnpm lumiose build
```

Build with Node: Deno reads the project's `package.json` and `node_modules`. The build writes
`dist/client` and `dist/server/entry.js` ([the server build](../reference/server-entry.md)).

## 2. Deploy

```sh
deno serve --allow-net --allow-read --allow-env \
  --port 3000 dist/server/entry.js
```

Serve the server build from the project directory. `--allow-read` covers `dist/client` and
`node_modules`, `--allow-env` the environment that `env()` and `ctx.env` read.

## 3. Verify

```sh
curl -sI http://localhost:3000/ | head -n 1
```

```text
HTTP/1.1 200 OK
```

## Notes

- The handler serves the static files of `dist/client` (with their `.br`/`.gz` copies, `ETag`s
  and a year of caching for content-hashed assets), then the app, with `lumiose({ headers })`.
- `ctx.platform.clientAddress` is the handler info's `remoteAddr.hostname`.
- The app's responses were not compressed in the local tests (streamed pages included): put a
  proxy or CDN that compresses in front ([VPS](vps.md#3-deploy)).
- **Deno Deploy** runs modules that export `{ fetch }`, but it is not tested: the server build
  imports npm packages from `node_modules` and reads `dist/client` from disk, which a deployment
  must include.
