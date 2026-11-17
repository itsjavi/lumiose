# Railway

> Run a Lumiose app on Railway with the Node adapter and Railway's Node builder, or from the Docker guide's image.

> **Status:** Not tested on Railway yet ([verification table](README.md#verification)).

## 1. Configure

```json file=package.json
{
  "scripts": {
    "build": "lumiose build",
    "start": "node server.ts"
  },
  "engines": { "node": ">=24" }
}
```

```json file=railway.json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "buildCommand": "pnpm build" },
  "deploy": {
    "startCommand": "node server.ts",
    "healthcheckPath": "/"
  }
}
```

Railway uses the `Dockerfile` when the repository has one ([Docker](docker.md)). Otherwise it
builds with Node and runs the `build` and `start` scripts of `package.json`. Or pin the commands in `railway.json`.

## 2. Deploy

Create a service from the repository. Add `LUMIOSE_SECRET` in the service's variables when the
app signs cookies, then generate a domain in the service's networking settings.

## 3. Verify

```sh
curl -sI https://my-app.up.railway.app/ | head -n 1
```

```text
HTTP/2 200
```

Use the domain Railway generated. Railway sets `PORT`, which `createServer()` reads.
