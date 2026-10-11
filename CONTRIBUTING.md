# Contributing

## Setup

Node ≥ 24, pnpm (the version in `package.json`'s `packageManager`) and Rust (the toolchain in
`rust-toolchain.toml`, installed by `rustup` on first use).

```sh
pnpm install
pnpm build:compiler   # the native compiler (crates/lumiose_napi) into packages/compiler
pnpm check            # what CI runs: build, typecheck, lint, example formatting, tests, size, cargo test
pnpm pack:check       # pack the publishable packages and check the tarballs (--smoke: build an app with them)
pnpm release:version 0.2.0 --dry-run   # what a release would change (see Releases)
```

Changes to the website (`apps/web`) follow [its contributing notes](apps/web/CONTRIBUTING.md): the
WCAG 2.2 AA axe suite and the manual accessibility checklist (decision-39).

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
or is rejected by `npm publish --dry-run` (skipped for versions npm already has, which it refuses
even as a dry run). With `--smoke` it also creates an app with the packed
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
| `compiler-wasm32-wasip1-threads`         | Ubuntu                      | `NAPI_RS_FORCE_WASI=error`           |
| `lumiose-wasm` (`wasm-web`, `wasm-node`) | Ubuntu                      | Node, `wasm-bindgen --target nodejs` |

The smoke test (`.github/scripts/smoke-napi.mjs`) loads the binary through the package's loader,
checks that the native binary (not the WASI fallback) loaded and compiles a component. Download
the artifacts from the workflow run (`gh run download <run-id>`). Each napi artifact is the binary of
one `@lumiose/compiler-<platform>` package (`packages/compiler/npm/<platform>`, created by
`napi create-npm-dirs` from the `napi.targets` of `packages/compiler/package.json`), which
`@lumiose/compiler` lists as optional dependencies, so npm installs only the one that fits; the
WASI build (`@lumiose/compiler-wasm32-wasi`) is the fallback where none fits. In this workspace the
loader finds the binary that `pnpm build:compiler` writes into `packages/compiler` first.

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

## Releases

All published packages, the `@lumiose/compiler-<platform>` packages and the Cargo workspace share
one version (lockstep); nothing is bumped by hand.

1. `pnpm release:version <x.y.z> --dry-run` prints the files it would change and the changelog
   section. Without `--dry-run`, on a clean working tree, `scripts/release.ts` sets the version of
   every published package and of `[workspace.package]` in `Cargo.toml` (and `Cargo.lock`), the
   version the napi loader (`packages/compiler/index.js`) expects of its platform packages and the
   one the generated `llms.txt`/`llms-full.txt` name, pins
   internal dependencies that are not `workspace:` to it (pnpm pins `workspace:*` when packing),
   prepends the release to `CHANGELOG.md` from the Conventional Commits since the last `v*` tag
   (breaking changes, `feat`, `fix`, `perf`; `--since <rev>` picks another start), commits
   `chore(release): vX.Y.Z` and creates the annotated tag `vX.Y.Z`. It pushes nothing.
2. `git push origin HEAD vX.Y.Z` starts `.github/workflows/release.yml`: the Binaries workflow
   builds and smoke-tests every compiler binary, then `scripts/publish.ts` packs every package,
   puts each binary into its platform package, checks that the tag names the packages' version,
   and publishes with npm provenance in dependency order (platform packages, `@lumiose/compiler`,
   `lumiose`, then the tooling). Prereleases (`x.y.z-rc.1`) go to the `next` dist-tag.
3. Until the repository variable `LUMIOSE_PUBLISH` is `true` (with npm trusted publishing set up
   for the packages, or an `NPM_TOKEN` secret), the workflow is a dry run (`npm publish --dry-run`)
   and publishes nothing. A manual run (workflow_dispatch) is always a dry run.

CI exercises the same path without publishing: the `pack` job's `pnpm pack:check` runs
`npm publish --dry-run` in publish order, and `node --test scripts/*.test.ts` covers
`release:version` (dry run and a real run in a scratch repository).
