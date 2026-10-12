# Docker

> A multi-stage Dockerfile for a Lumiose app served by `@lumiose/adapter-node`: built with every dependency, run on `node:24-alpine` with production dependencies only, as a non-root user, with a health check.

This page is for an app with server routes and the `server.ts` that `create-lumiose --template ssr`
writes (`@lumiose/adapter-node`'s `createServer()`). The same image runs on any host that runs
containers: a [VPS](vps.md) with Docker, [Coolify](coolify.md), Kubernetes, a container platform.

## The Dockerfile

Put it at the root of the project, next to `package.json` and `pnpm-lock.yaml`:

```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=24

# Build: all dependencies, then `lumiose build`. Debian (glibc): the compiler ships native
# binaries for Linux x64 and arm64 on glibc, and for x64 only on musl (Alpine).
FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm CI=true
RUN npm install --global pnpm@11
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production dependencies only, on the runtime's base image (native packages match its C library).
FROM node:${NODE_VERSION}-alpine AS prod-deps
ENV PNPM_HOME=/pnpm CI=true
RUN npm install --global pnpm@11
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# Runtime: Node, the build output and production dependencies, as the unprivileged `node` user.
FROM node:${NODE_VERSION}-alpine
# tini passes `docker stop`'s SIGTERM on to Node, which ignores it as PID 1.
RUN apk add --no-cache tini
ENV NODE_ENV=production PORT=3000 HEALTHCHECK_PATH=/
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY package.json server.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + process.env.HEALTHCHECK_PATH).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.ts"]
```

And a `.dockerignore`, so the build context leaves out what the image builds itself:

```text
node_modules
dist
.lumiose
.git
.env*
*.log
```

Build and run it:

```sh
docker build -t my-app .
docker run --rm -p 3000:3000 -e LUMIOSE_SECRET="$(openssl rand -base64 32)" my-app
```

`LUMIOSE_SECRET` is only needed when the app signs cookies (`signedCookie()`); pass every secret
at run time like this, never as a build argument or an `ENV` line, which stay in the image. The
other settings (`ORIGIN` behind a proxy, `PORT`, `HOST`) are in
[Production settings](README.md#production-settings).

## How it works

- **Three stages.** `build` installs everything and runs `lumiose build`. `prod-deps` installs only
  `dependencies`, so Vite, the compiler and the CLI never reach the image. The last stage copies
  `dist/`, those `node_modules` and `server.ts` onto a fresh `node:24-alpine`. The server build
  bundles your server code and the Lumiose runtime; other npm packages stay imports, which is why
  production dependencies are installed.
- **Debian to build, Alpine to run.** `lumiose build` loads the compiler's native binary, published
  for Linux x64 and arm64 on glibc but only x64 on musl, so the build stage is `node:24-slim`,
  which builds on both architectures (an arm64 laptop or server included). The build output is
  JavaScript and static files, so it runs on Alpine. `prod-deps` uses the runtime's image so that a
  dependency with a native addon is built for musl.
- **Non-root.** The app runs as `node` (uid 1000), and the files it runs are owned by root, so it
  cannot change them. A directory it writes to, such as a SQLite database's, must be created for
  it before `USER node` and mounted as a volume:
  `RUN mkdir /data && chown node:node /data`, then `docker run -v my-app-data:/data …`.
- **Health check.** `HEALTHCHECK` fetches `HEALTHCHECK_PATH` (default `/`) with Node, since Alpine
  has no curl; any `2xx` answer is healthy. Point it at a cheap URL, such as a `GET` endpoint
  that returns `ok` without rendering a page: `docker run -e HEALTHCHECK_PATH=/healthz …`.
  `--start-interval` (Docker Engine 25 or later) checks every 2 s while the container starts.
- **Signals.** Node as PID 1 ignores `SIGTERM`, so `docker stop` would wait 10 s and kill it.
  [tini](https://github.com/krallin/tini) passes the signal on, and Node exits at once.
- **pnpm.** `npm install --global pnpm@11` installs pnpm; when `package.json` has a
  `packageManager` field (`pnpm@11.x.y`), pnpm switches to that version. The cache mounts keep
  the package store between builds. `pnpm-workspace.yaml*` copies the file when it exists
  (pnpm 11 keeps settings there).

**With npm** instead of pnpm: drop the `npm install --global pnpm@11` lines, the `PNPM_HOME`
variable and the cache mounts, copy `package-lock.json` instead of `pnpm-lock.yaml`, and run
`npm ci`, `npm run build` and `npm ci --omit=dev`. This variant has not been tested.

## The bookshelf sample

The repository's [bookshelf sample](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-bookshelf)
has a Dockerfile of the same shape, built from the monorepo instead of from npm:

- The build context is the repository root (`docker build -f examples/ssr-bookshelf/Dockerfile .`).
  Its ignore file is `examples/ssr-bookshelf/Dockerfile.dockerignore`: BuildKit reads the ignore
  file named after the Dockerfile before the one at the context root. It allows only the
  workspace packages the sample uses.
- A first stage compiles the compiler's native binary from the Rust sources, because the
  monorepo has no Linux binaries (npm installs them as `@lumiose/compiler-linux-*`).
- pnpm installs with `--filter "@lumiose-examples/ssr-bookshelf..."`, and the production install
  with `--filter-prod`, which leaves out the workspace's dev dependencies.
- The build seeds a throwaway database, because the genre pages are prerendered from it. The
  container seeds `/data/bookshelf.db` on its first start, and the health check calls `/api/me`.

```sh
docker build -f examples/ssr-bookshelf/Dockerfile -t lumiose-bookshelf .
docker run --rm -p 3000:3000 -e LUMIOSE_SECRET="$(openssl rand -base64 32)" \
  -v bookshelf-data:/data lumiose-bookshelf
```

`node examples/ssr-bookshelf/e2e/docker-smoke.ts` builds the image and checks a running container:
health, a server-rendered page compressed with brotli, a database query, a sign-in, prerendered pages, the
`immutable` caching of hashed assets and their precompressed copies, the `node` user, no dev
dependency in the image, and a prompt stop. It needs Docker, skips itself in CI, and is never run
by CI: a cold build compiles the Rust compiler (about 1 minute on an 8-core arm64 machine).
