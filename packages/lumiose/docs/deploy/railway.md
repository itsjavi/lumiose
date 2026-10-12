# Railway

> Run a Lumiose app on Railway: `@lumiose/adapter-node`'s `server.ts` built with Railway's Node builder, or the [Docker](docker.md) guide's image.

Not tested on Railway yet: see the [verification table](README.md#verification).

Create a service from the repository. Railway uses the `Dockerfile` when the repository has one
([Docker](docker.md)); otherwise it builds with Node and runs the `build` and `start` scripts of
`package.json`:

```json
{
  "scripts": {
    "build": "lumiose build",
    "start": "node server.ts"
  },
  "engines": { "node": ">=24" }
}
```

Or pin the commands in `railway.json`:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "buildCommand": "pnpm build" },
  "deploy": { "startCommand": "node server.ts", "healthcheckPath": "/" }
}
```

Railway sets `PORT`, which `createServer()` reads. Add `LUMIOSE_SECRET` in the service's
variables when the app signs cookies, then generate a domain in the service's networking settings.
