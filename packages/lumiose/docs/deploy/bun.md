# Bun

> Run a Lumiose build with Bun, which serves the server build's fetch handler and the static files as they are.

> **Status:** Tested locally with Bun 1.4.2 ([verification table](README.md#verification)).

## 1. Build

```sh
pnpm lumiose build
```

Build with Node or Bun. The build writes `dist/client` and `dist/server/entry.js`
([the server build](../reference/server-entry.md)).

## 2. Deploy

```sh
NODE_ENV=production PORT=3000 bun dist/server/entry.js
```

Start the server build from the project directory, so that the npm packages it imports resolve
from `node_modules`. Bun starts a server for a module whose default export has a `fetch` method,
on `PORT` (default 3000).

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
- `ctx.platform.clientAddress` is Bun's `server.requestIP(request)`.
- Bun does not compress responses on the fly: put a proxy or CDN that does in front for
  server-rendered pages ([VPS](vps.md#3-deploy)).

### In a container

```dockerfile
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 3000
CMD ["bun", "dist/server/entry.js"]
```

The image is not tested; the [Docker](docker.md) guide's Node image is.
