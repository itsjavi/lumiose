# Contributing

## Setup

Node ≥ 24, pnpm (the version in `package.json`'s `packageManager`) and Rust (the toolchain in
`rust-toolchain.toml`, installed by `rustup` on first use).

```sh
pnpm install
pnpm build:compiler   # the native compiler (crates/lumiose_napi) into packages/compiler
pnpm check            # what CI runs: build, typecheck, lint, example formatting, tests, size, cargo test
pnpm pack:check       # pack the publishable packages and check the tarballs (--smoke: build an app with them)
pnpm release:version <x.y.z> --dry-run   # what a release would change (see Releases)
pnpm --filter lumiose test:properties [runs]   # the property tests with many cases (default 20000)
```

Property tests (`*.property.test.ts`, [fast-check](https://fast-check.dev)) cover request body
parsing under the limits, the Origin check, redirect targets and unsafe URLs in rendered HTML
(decision-56), and the reactive core against a naive reference on random signal graphs
(`core/reactive.property.test.ts`, one seed per 10 cases). `pnpm test` runs 100 cases of each; `test:properties` runs many more (the nightly
workflow's). A failure prints its seed: rerun with `LUMIOSE_PROPERTY_SEED=<seed>` to reproduce it.

### Fuzzing

`fuzz/` holds the [cargo-fuzz](https://rust-fuzz.github.io/book/cargo-fuzz.html) targets of the
Rust crates (decision-56), a workspace of its own: `scan` (the `.stsx` scanner and its masking
invariant), `compile_client` (the JSX transform and client codegen), `compile_server` (SSR
codegen), `css_process` (style blocks, `$` constants and scoping in `lumiose_css`),
`svg_component` (the SVG allowlist sanitizer), `content_markdown` and `content_html` (Markdown,
frontmatter and HTML imports, with their depth limits). `cargo fuzz list --fuzz-dir fuzz` lists
them. To run one:

```sh
cargo install cargo-fuzz                  # once
rustup toolchain install nightly          # once: the sanitizers need nightly
fuzz/seed.sh                              # seed fuzz/corpus/<target> with the test fixtures
cargo +nightly fuzz run scan --fuzz-dir fuzz -- -max_total_time=300
```

On macOS add `RUSTFLAGS="-Clink-arg=-undefined -Clink-arg=dynamic_lookup"` (a dependency also
builds a dylib, which macOS would not link against the fuzzer's coverage symbols). cargo-fuzz
builds for the target it was itself built for: with its prebuilt Linux binary, a static musl one,
pass `--target x86_64-unknown-linux-gnu`, as the nightly workflow does, since AddressSanitizer
needs a dynamically linked libc. A crash stops the run and writes its input to
`fuzz/artifacts/<target>/crash-<hash>`; replay it with
`cargo +nightly fuzz run <target> --fuzz-dir fuzz fuzz/artifacts/<target>/crash-<hash>`, and shrink
it with `cargo +nightly fuzz tmin <target> --fuzz-dir fuzz <file>`. Add the minimized input to the
crate's tests with the fix. The corpus, artifacts and build output are ignored by Git.

Changes to the website (`apps/web`) follow [its contributing notes](apps/web/CONTRIBUTING.md): the
WCAG 2.2 AA axe suite and the manual accessibility checklist (decision-39).

## Run anything: `pnpm demo`

Every package in the repo that serves HTML (the examples, the website with its playground, the site-kit showcase, the benchmark apps and results viewers, the eval results viewer and the e2e test apps) can be started from the root:

```sh
pnpm demo                          # pick one from a list grouped by kind
pnpm demo chip                     # fuzzy name: starts spa-chiptune in dev
pnpm demo bookshelf --prod         # build, then its production server (preview, start or serve)
pnpm demo web --port 5000 --open   # choose the port, open the browser when it answers
pnpm demo --list                   # list without starting (--json for tools)
```

It prints the URL once the server answers; Ctrl+C stops the server and everything it started. Entries come from the workspace packages that have a `dev`, `view`, `start`, `serve` or `preview` script, so new apps appear on their own. A package can describe itself with a `demo` field in its `package.json`: `"demo": { "title": "Chiptune tracker (SPA)", "kind": "example" }` (`kind`: `example`, `site`, `benchmark`, `eval` or `e2e`; optional `name`, `setup` scripts to run first such as `["seed"]`, `port: "flag" | "env"`, or `"demo": false` to hide it). Details: [`scripts/demo.ts`](scripts/demo.ts); tests: `node --test scripts/demo.test.ts`.

## Website

The website is assembled into one static site: `apps/web` (the landing page at `/`, the docs at `/docs`, the `/showcase` and `/benchmarks` pages, and the playground at `/playground`), the example apps that need no server (the real apps `examples/spa-chiptune` and `spa-dotmatrix` at `/showcase/chiptune-tracker/` and `/showcase/dotmatrix/`, indexed and in `sitemap.xml`; the samples `ssg-travel-journal` and `vite-counter` at `/demos/travel-journal/` and `/demos/counter/`, with `noindex` and out of the sitemap), the fullstack benchmark's results viewer with the committed results (`/benchmarks/fullstack/`) and the Lumiose js-framework-benchmark app (`/benchmarks/js-framework-benchmark/app/`).

```sh
pnpm build:site                  # builds the compiler, the website and the examples into dist/site
pnpm build:site --base /lumiose/   # served below a path, e.g. a GitHub project page
pnpm preview:site --base /lumiose/ # serves dist/site at http://localhost:4173/lumiose/
pnpm build:site --site-url https://example.com/   # the public URL for sitemap.xml (default on GitHub Actions: https://<owner>.github.io<base>)
```

`--skip-compiler` reuses an existing native compiler build. Each example gets `PUBLIC_LUMIOSE_SITE` (the site's base) and shows a small "Made with Lumiose" link back to the site when it is set; the static benchmark viewers get the same link. GitHub Pages answers every missing path with the root `404.html`; below an example that has its own `404.html` (the SPA shell of the chiptune tracker, the journal's 404 page), that page renders the example's instead, so deep links work. The old `/examples/<folder>/…` URLs redirect to the new homes with the same path, query and hash (Dotmatrix share links carry the song in `?song=…`), through a stub at each old root and the root `404.html`, with a meta refresh and a canonical link without JavaScript. The website's build also builds the playground's WebAssembly compiler (`apps/web/scripts/playground-assets.ts`), which needs `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli --version 0.2.129 --locked` (the version must match the workspace's `wasm-bindgen` pin). `pnpm demo web` builds it too when the toolchain is installed; without it the rest of the site runs and the playground page reports the missing compiler.

`.github/workflows/pages.yml` runs the same build on every push to `main` (or manually) and deploys `dist/site` to GitHub Pages, with the base taken from the Pages configuration. To enable it, set **Settings > Pages > Source** to **GitHub Actions** on the repository.

The README's headline numbers and stack comparison table are generated from the same committed results as the landing page (`apps/web/src/content/readme.ts`), between `<!-- generated:… -->` markers. After committing new benchmark results (`benchmarks/*/RESULTS.md`, `benchmarks/fullstack/results/`) or editing the stack facts in `apps/web/src/content/stacks.ts`, run `pnpm readme:gen` and commit the README with them; the website's content tests fail while it is stale.

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

`.github/workflows/fuzz.yml` runs nightly (and by hand from the Actions tab), never on push: each
target of `fuzz/` for 10 minutes on nightly Rust with AddressSanitizer, its corpus kept between
runs, and `pnpm --filter lumiose test:properties 200000`. A crash fails the run and uploads its
input as an artifact; a property failure prints its seed (see Fuzzing above).

## Packages

The published packages share one version: `lumiose` (the runtime, no dependencies),
`@lumiose/vite` (the Vite plugin, dev server and build), `@lumiose/cli` (the `lumiose` command),
`@lumiose/compiler`, the deploy adapters (`@lumiose/adapter-node`, `-cloudflare`, `-vercel` and
`-netlify`), `@lumiose/query`, `@lumiose/language-server`, `@lumiose/eslint-plugin`,
`@lumiose/prettier-plugin` and `create-lumiose`: every package in `packages/` that is not
`private`, so a new one is published with the next release. In the workspace their `exports` point at the
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

`.github/workflows/binaries.yml` builds `@lumiose/compiler`'s native binary for each supported
platform and the WebAssembly compiler, and uploads them as workflow artifacts.

It runs only when a push or pull request to `main` changes what goes into the binaries:

- `crates/**`, `Cargo.toml`, `Cargo.lock` and `rust-toolchain.toml`
- `packages/compiler/**`
- the workflow itself and its smoke scripts

Every release runs it too, because `release.yml` calls it, and you can start it by hand. Releases
call it with `release: true`, which also builds the release-only targets (the `napi-release` job,
marked below); a manual run builds them when its `release` box is checked. CI and the Pages build
compile the compiler they need themselves.

| Artifact                                              | Built on                                   | Smoke test                           |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| `compiler-aarch64-apple-darwin`                       | macOS (Apple silicon)                      | native                               |
| `compiler-x86_64-apple-darwin`                        | macOS, cross-compiled                      | x64 Node under Rosetta               |
| `compiler-x86_64-unknown-linux-gnu`                   | Ubuntu 22.04 (glibc 2.35)                  | native                               |
| `compiler-aarch64-unknown-linux-gnu`                  | Ubuntu 22.04 on arm64                      | native                               |
| `compiler-x86_64-unknown-linux-musl`                  | Ubuntu, with cargo-zigbuild                | `node:24-alpine` container           |
| `compiler-aarch64-unknown-linux-musl` (releases only) | Ubuntu 22.04 on arm64, with cargo-zigbuild | `node:24-alpine` container (arm64)   |
| `compiler-x86_64-pc-windows-msvc`                     | Windows                                    | native                               |
| `compiler-wasm32-wasip1-threads`                      | Ubuntu                                     | `NAPI_RS_FORCE_WASI=error`           |
| `lumiose-wasm` (`wasm-web`, `wasm-node`)              | Ubuntu                                     | Node, `wasm-bindgen --target nodejs` |

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

   Before it writes anything, the **scale gate** (decision-55) runs the large-app benchmark as an
   A/B of the last `v*` tag and the working tree
   (`pnpm --filter @lumiose/bench-large-app ab <tag> . --json`, about 18 minutes, on this machine:
   never in CI) and stops the release when any metric (production build, dev cold start, HMR
   latency, server memory) is more than 20% worse. Its medians and ratios become the `### Scale`
   section of the changelog, so the release notes carry them. A quiet machine gives steadier
   numbers. `--skip-scale-gate` skips it (the notes then say it was not measured); a dry run only
   says it would run; the first release has nothing to compare with.

2. `git push origin HEAD vX.Y.Z` starts `.github/workflows/release.yml`: the Binaries workflow
   builds and smoke-tests every compiler binary, then `scripts/publish.ts` packs every package,
   puts each binary into its platform package, checks that the tag names the packages' version,
   and publishes with npm provenance in dependency order (platform packages, `@lumiose/compiler`,
   `lumiose`, then the tooling). Prereleases (`x.y.z-rc.1`) go to the `next` dist-tag. After the
   publish, the `github-release` job creates the tag's GitHub release, with the version's
   `CHANGELOG.md` section as notes (`node scripts/release-notes.ts <x.y.z>` prints them) and marked
   as a pre-release for `x.y.z-*` versions.
3. Until the repository variable `LUMIOSE_PUBLISH` is `true` (with npm trusted publishing set up
   for the packages, or an `NPM_TOKEN` secret), the workflow is a dry run (`npm publish --dry-run`)
   and publishes nothing. A manual run (workflow_dispatch) is always a dry run.

CI exercises the same path without publishing: the `pack` job's `pnpm pack:check` runs
`npm publish --dry-run` in publish order, and `node --test scripts/*.test.ts` covers
`release:version` (dry run and a real run in a scratch repository).
