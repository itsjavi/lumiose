# Deploy

> Run a Lumiose build in production: what `lumiose build` writes, the settings a server needs, a guide per target, and what each guide was verified on.

## What to deploy

`lumiose build` writes `dist/` ([Rendering modes](../concepts/rendering-modes.md)):

- `dist/client`: the browser assets (content-hashed, under `assets/`), the files of `public/`, and
  the prerendered pages, with `.br` and `.gz` copies of every text file of 1 kB or more.
- `dist/server/entry.js`: the request handler for server-rendered pages, endpoints and form
  actions. It bundles your server code and the Lumiose runtime; other npm packages stay imports,
  so production needs the app's `dependencies` installed.

A site whose every route is prerendered builds no `dist/server`: any static host serves
`dist/client`. Anything else needs a runtime for `dist/server/entry.js`. On Node,
`@lumiose/adapter-node` serves both directories, from the `server.ts` that
`create-lumiose --template ssr` writes ([reference](../reference/adapter-node.md)); the guides
below run it on Docker, a VPS and Coolify.

## Production settings

The Node adapter and the request handler read these environment variables:

| Variable         | Set it to                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`       | `production`. The adapter sets it when it is unset, before the build loads.                                                                                     |
| `PORT`           | The port to listen on. Default: `3000`.                                                                                                                         |
| `HOST`           | The address to listen on. Default: every address, which a container needs. Behind a proxy on the same machine, `127.0.0.1`.                                     |
| `ORIGIN`         | The public origin, such as `https://example.com`, behind a proxy that terminates TLS or rewrites the host. Request URLs (`url()`, `ctx.url`) are built from it. |
| `LUMIOSE_SECRET` | When the app signs cookies (`signedCookie()`): a random secret of at least 32 bytes (`openssl rand -base64 32`). Never commit it or bake it into an image.      |

## Guides

- [Docker](docker.md): A multi-stage Dockerfile: `node:24-alpine`, production dependencies only, a non-root user and a health check.
- [VPS](vps.md): The Node adapter under systemd or pm2, behind Caddy or nginx, and what the adapter already does for compression and caching.
- [Coolify](coolify.md): Deploy from the Dockerfile with Coolify's Dockerfile build pack.

## Verification

Each target's status says how far its guide has been checked:

- **Verified on the platform**: deployed to the real service by hand, on the date given.
- **Tested locally**: run on a development machine in the target's own runtime (a container, the
  platform's emulator), by the script named or by hand; not on the real service.
- **Not tested**: written from the platform's documentation only.
- **Planned**: no guide yet.

<!-- To add a target: a page in this directory, a link in the Deploy list of ../README.md (which
     also places it in the website's navigation and llms.txt), and a row below. -->

| Target                   | Guide                                    | Status         | Checked    | What was checked                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------- | -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker                   | [Docker](docker.md)                      | Tested locally | 2026-10-12 | The Dockerfile on the page, on a `create-lumiose@0.2.0 --template ssr` project with packages from npm: builds, healthy, serves pages (brotli) and `immutable` assets, runs as `node`, stops in under a second. Docker 29.8, linux/arm64. The npm variant is not tested.                                                             |
| Docker, bookshelf sample | [Docker](docker.md#the-bookshelf-sample) | Tested locally | 2026-10-12 | `examples/ssr-bookshelf/e2e/docker-smoke.ts` (local only, not in CI): health, a streamed page compressed on the fly, database queries, a sign-in form post, prerendered pages, `immutable` hashed assets served from their `.br` copies, the `node` user, no dev dependency in the image, a prompt stop. Docker 29.8, linux/arm64.  |
| VPS: systemd             | [VPS](vps.md#systemd)                    | Tested locally | 2026-10-12 | The unit on the page ran the npm project under systemd 252 (Debian 12, in a privileged container): active, serving, stopped cleanly; `systemd-analyze verify` passes. Not on a VPS.                                                                                                                                                 |
| VPS: pm2                 | [VPS](vps.md#pm2)                        | Tested locally | 2026-10-12 | The ecosystem file on the page with pm2 6.0 (fork mode) in a container: serves, inherits the shell's variables, survives `pm2 save` and `pm2 resurrect`. `pm2 startup` and cluster mode are not tested.                                                                                                                             |
| Caddy                    | [VPS](vps.md#caddy)                      | Tested locally | 2026-10-12 | The Caddyfile on the page (Caddy 2.11, `localhost` with Caddy's local CA instead of a public certificate) in front of the bookshelf container: HTTP to HTTPS redirect, HTTP/2, streamed chunks not held back, brotli and gzip passed through unchanged (with `encode` too), `immutable` assets, a form post and a cross-site `403`. |
| nginx                    | [VPS](vps.md#nginx)                      | Tested locally | 2026-10-12 | The config on the page (nginx 1.31, a self-signed certificate in place of certbot's) in front of the bookshelf container: `nginx -t`, the same checks as Caddy (with `gzip on` too); streaming also with nginx's default `proxy_buffering on`.                                                                                      |
| Coolify                  | [Coolify](coolify.md)                    | Not tested     |            | Not deployed to a Coolify instance yet. It builds the Dockerfile tested above; the steps follow Coolify v4's documentation.                                                                                                                                                                                                         |
| Cloudflare Workers       |                                          | Planned        |            |                                                                                                                                                                                                                                                                                                                                     |
| Vercel                   |                                          | Planned        |            |                                                                                                                                                                                                                                                                                                                                     |
| Netlify                  |                                          | Planned        |            |                                                                                                                                                                                                                                                                                                                                     |
