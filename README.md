# Lumen

A TypeScript-first web framework: `.stsx` components, signals, islands and scoped styles, compiled by a Rust compiler. The framework docs live in [`packages/lumen/docs/`](packages/lumen/docs/).

## Website

The website is two Lumen apps assembled into one static site: `apps/web` (the landing page at `/` and the docs at `/docs`) and `apps/playground` (at `/playground`).

```sh
pnpm build:site                  # builds the compiler and both apps into dist/site
pnpm build:site --base /lumen/   # served below a path, e.g. a GitHub project page
pnpm preview:site --base /lumen/ # serves dist/site at http://localhost:4173/lumen/
```

`--skip-compiler` reuses an existing native compiler build. The playground also builds the WebAssembly compiler, which needs `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli --version 0.2.129 --locked` (the version must match the workspace's `wasm-bindgen` pin).

`.github/workflows/pages.yml` runs the same build on every push to `main` (or manually) and deploys `dist/site` to GitHub Pages, with the base taken from the Pages configuration. To enable it, set **Settings > Pages > Source** to **GitHub Actions** on the repository.
