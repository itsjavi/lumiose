# Render

> Run a Lumiose app on Render as a Node web service: `@lumiose/adapter-node`'s `server.ts`, or the [Docker](docker.md) guide's image.

Not tested on Render yet: see the [verification table](README.md#verification).

Create a **Web Service** from the repository with the Node runtime:

| Setting       | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start command | `node server.ts`                                                  |
| Health check  | `/` (or a cheap endpoint such as `/healthz`)                      |

Set the environment variable `NODE_VERSION` to `24` (Lumiose needs Node 24 or later), and
`LUMIOSE_SECRET` when the app signs cookies. Render sets `PORT`, which `createServer()` reads; its
proxy terminates TLS and forwards the `Host` header, so `ORIGIN` is not needed.

Or as a blueprint:

```yaml
# render.yaml
services:
  - type: web
    name: my-app
    runtime: node
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm build
    startCommand: node server.ts
    healthCheckPath: /
    envVars:
      - key: NODE_VERSION
        value: "24"
      - key: LUMIOSE_SECRET
        generateValue: true
```

With the Docker runtime instead, Render builds the Dockerfile from [Docker](docker.md) and runs it
as is.

A site whose every route is prerendered can be a **Static Site** instead: build command as above,
publish directory `dist/client` (see [Static hosts](static.md)).
