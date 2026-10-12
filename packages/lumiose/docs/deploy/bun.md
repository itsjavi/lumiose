# Bun

> Run a Lumiose build with Bun: `dist/server/entry.js` exports `{ fetch }`, which Bun serves as it is, static files included.

Tested locally with Bun 1.4.2: see the [verification table](README.md#verification).

## Run it

Build with Node or Bun, then start the server build from the project directory, so that the npm
packages it imports resolve from `node_modules`:

```sh
pnpm lumiose build
NODE_ENV=production PORT=3000 bun dist/server/entry.js
```

Bun starts a server for a module whose default export has a `fetch` method, on `PORT` (default
3000). The handler serves the static files of `dist/client` (with their `.br`/`.gz` copies,
`ETag`s and a year of caching for content-hashed assets), then the app, with
`lumiose({ headers })`. `ctx.platform.clientAddress` is Bun's `server.requestIP(request)`.

Bun does not compress responses on the fly: put a proxy or CDN that does in front for
server-rendered pages ([VPS](vps.md#the-proxy)).

## In a container

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

See also: [the server build](../reference/server-entry.md).
