# syntax=docker/dockerfile:1
#
# The bookshelf sample in a container, built from this monorepo: the build context is the
# repository root (Dockerfile.dockerignore, next to this file, keeps it to what the image needs).
#
#   docker build -f examples/ssr-bookshelf/Dockerfile -t lumiose-bookshelf .
#   docker run --rm -p 3000:3000 -e LUMIOSE_SECRET="$(openssl rand -hex 32)" \
#     -v bookshelf-data:/data lumiose-bookshelf
#
# `node examples/ssr-bookshelf/e2e/docker-smoke.ts` builds it and checks the running container.
# A project of your own, with its dependencies from npm, needs no compiler stage and no workspace
# filters: see packages/lumiose/docs/deploy/docker.md.

ARG NODE_VERSION=24
ARG RUST_VERSION=1.98.1

# 1. The compiler's native binding for this Linux. npm installs it as @lumiose/compiler-linux-*;
# the monorepo only has the host's, so it is compiled here. It only runs during the build, so the
# release profile skips LTO to compile faster.
FROM rust:${RUST_VERSION}-slim-bookworm AS compiler
WORKDIR /repo
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates crates
ENV CARGO_PROFILE_RELEASE_LTO=false CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/repo/target \
    cargo build --release --locked -p lumiose_napi \
    && cp target/release/liblumiose_napi.so /compiler.node

# 2. `lumiose build`, with the workspace packages the sample uses. Debian (glibc), like the
# compiler stage; the build output is plain JavaScript and assets, so the runtime can be Alpine.
# This stage stays Debian when npm has an arm64 musl binary too (after 0.2.0): the binding is
# compiled from source above, not installed from npm.
# The genre pages are prerendered from the database, so the build seeds a throwaway one (the
# seed is deterministic: the runtime's database has the same genres).
FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@lumiose-examples/ssr-bookshelf..."
COPY --from=compiler /compiler.node /tmp/compiler.node
RUN cp /tmp/compiler.node "packages/compiler/compiler.linux-$(node -p process.arch)-gnu.node" \
    && export BOOKSHELF_DB=/tmp/build.db \
    && pnpm --filter @lumiose-examples/ssr-bookshelf seed \
    && pnpm --filter @lumiose-examples/ssr-bookshelf build

# 3. Production dependencies only (no Vite, no compiler), on the runtime's base image so native
# packages match its C library. Here they are workspace packages, which Node runs from source.
FROM node:${NODE_VERSION}-alpine AS prod-deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/lumiose/package.json packages/lumiose/
COPY packages/lumiose/src packages/lumiose/src
COPY packages/adapter-node/package.json packages/adapter-node/
COPY packages/adapter-node/src packages/adapter-node/src
COPY examples/ssr-bookshelf/package.json examples/ssr-bookshelf/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter-prod "@lumiose-examples/ssr-bookshelf..."

# 4. The runtime: Node, the build output and production dependencies, run by an unprivileged user.
FROM node:${NODE_VERSION}-alpine
# tini forwards `docker stop`'s SIGTERM to Node and reaps zombies (Node does neither as PID 1).
RUN apk add --no-cache tini && mkdir /data && chown node:node /data
ENV NODE_ENV=production PORT=3000 BOOKSHELF_DB=/data/bookshelf.db HEALTHCHECK_PATH=/api/me
WORKDIR /app/examples/ssr-bookshelf
COPY --from=prod-deps /repo /app
COPY --from=build /repo/examples/ssr-bookshelf/dist dist
COPY examples/ssr-bookshelf/server.ts ./
# The seed script and the modules it imports (node:sqlite, node:crypto only).
COPY examples/ssr-bookshelf/src/server/*.server.ts src/server/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + process.env.HEALTHCHECK_PATH).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/sbin/tini", "--"]
# Seeds the database on the first start (an empty volume), then serves.
CMD ["sh", "-c", "node src/server/seed.server.ts --if-empty && exec node server.ts"]
