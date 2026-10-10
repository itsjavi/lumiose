# Contributing

## Setup

Node ≥ 24, pnpm (the version in `package.json`'s `packageManager`) and Rust (the toolchain in
`rust-toolchain.toml`, installed by `rustup` on first use).

```sh
pnpm install
pnpm build:compiler   # the native compiler (crates/lumiose_napi) into packages/compiler
pnpm check            # what CI runs: build, typecheck, lint, example formatting, tests, size, cargo test
pnpm pack:check       # pack the publishable packages and check the tarballs (--smoke: build an app with them)
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`, on Linux, macOS and
Windows:

- **check**: `pnpm build:compiler`, `pnpm typecheck`, `pnpm lint`, `pnpm fmt:examples`,
  `pnpm --filter lumiose size`, `pnpm test` (Vitest), `node --test scripts/*.test.ts`, and
  `cargo fmt --check`, `cargo clippy` (warnings are errors) and `cargo test` for the workspace.
- **e2e**: the Playwright suites (Chromium). Linux runs every suite (`examples/*` and `apps/*`
  with a `playwright.config.ts`); macOS and Windows run a smoke subset (`examples/vite-counter`,
  `examples/islands-e2e`). Failed runs upload the `test-results` folders.

- **pack** (Linux): `pnpm pack:check --smoke`, below.

pnpm's store, Cargo's registry and `target/`, and the Playwright browsers are cached.

## Packages

The published packages share one version: `lumiose` (the runtime, no dependencies),
`@lumiose/vite` (the Vite plugin, dev server and build), `@lumiose/cli` (the `lumiose` command),
`@lumiose/compiler`, `@lumiose/adapter-node`, `@lumiose/language-server`, `@lumiose/eslint-plugin`,
`@lumiose/prettier-plugin` and `create-lumiose`. In the workspace their `exports` point at the
TypeScript sources, which Node runs directly. Published, they point at `dist/` instead
(`publishConfig`, applied by `pnpm pack`): `pnpm build` in a package (also its `prepack`) runs
`scripts/build-package.ts`, which compiles `src/` with the package's `tsconfig.build.json`
(JavaScript and declarations, tests and fixtures excluded). Our packages import each other's
modules through the undocumented `<package>/internal/*.ts` subpath, which maps to `dist/*.js` once
published.

`pnpm pack:check` packs every public package into `.local/pack/` and fails when a tarball ships
sources, tests or fixtures, misses a file an export or bin names, keeps a `workspace:` specifier,
or is rejected by `npm publish --dry-run`. With `--smoke` it also creates an app with the packed
create-lumiose (`--template ssr`), installs the tarballs into it, and runs `lumiose check` and
`lumiose build`. Nothing is published.

## Compiler binaries

`.github/workflows/binaries.yml` (same triggers) builds `@lumiose/compiler`'s native binary for
each supported platform and the WebAssembly compiler, and uploads them as workflow artifacts:

| Artifact                                 | Built on                    | Smoke test                           |
| ---------------------------------------- | --------------------------- | ------------------------------------ |
| `compiler-aarch64-apple-darwin`          | macOS (Apple silicon)       | native                               |
| `compiler-x86_64-apple-darwin`           | macOS, cross-compiled       | x64 Node under Rosetta               |
| `compiler-x86_64-unknown-linux-gnu`      | Ubuntu 22.04 (glibc 2.35)   | native                               |
| `compiler-aarch64-unknown-linux-gnu`     | Ubuntu 22.04 on arm64       | native                               |
| `compiler-x86_64-unknown-linux-musl`     | Ubuntu, with cargo-zigbuild | `node:24-alpine` container           |
| `compiler-x86_64-pc-windows-msvc`        | Windows                     | native                               |
| `lumiose-wasm` (`wasm-web`, `wasm-node`) | Ubuntu                      | Node, `wasm-bindgen --target nodejs` |

The smoke test (`.github/scripts/smoke-napi.mjs`) loads the binary through the package's loader,
checks that the native binary (not the WASI fallback) loaded and compiles a component. Download
the artifacts from the workflow run (`gh run download <run-id>`). Publishing them to npm waits for
the package names.

To build one target locally, from `packages/compiler`:

```sh
rustup target add x86_64-unknown-linux-musl
pnpm exec napi build --platform --release --esm --no-const-enum \
  --manifest-path ../../crates/lumiose_napi/Cargo.toml --output-dir . \
  --target x86_64-unknown-linux-musl -x   # -x: cross-compile with cargo-zigbuild (or cargo-xwin)
node ../../.github/scripts/smoke-napi.mjs
```

The WebAssembly compiler: `cargo build -p lumiose_wasm --release --target wasm32-unknown-unknown`,
then `wasm-bindgen --target web` (what the playground loads) or `--target nodejs`, with the
`wasm-bindgen-cli` version pinned in `Cargo.toml`.
