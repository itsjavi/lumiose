# Lumen

A TypeScript-first web framework: `.stsx` components, signals, islands and scoped styles, compiled by a Rust compiler. The framework docs live in [`packages/lumen/docs/`](packages/lumen/docs/).

## Website

The website is assembled into one static site: `apps/web` (the landing page at `/`, the docs at `/docs`, and the `/examples` and `/benchmarks` pages), `apps/playground` (at `/playground`), the example apps that need no server (`examples/spa-chiptune`, `spa-dotmatrix`, `ssg-travel-journal` and `vite-counter`, at `/examples/<name>/`), the fullstack benchmark's results viewer with the committed results (`/benchmarks/fullstack/`) and the Lumen js-framework-benchmark app (`/benchmarks/js-framework-benchmark/app/`).

```sh
pnpm build:site                  # builds the compiler and both apps into dist/site
pnpm build:site --base /lumen/   # served below a path, e.g. a GitHub project page
pnpm preview:site --base /lumen/ # serves dist/site at http://localhost:4173/lumen/
```

`--skip-compiler` reuses an existing native compiler build. GitHub Pages answers every missing path with the root `404.html`; below an example that has its own `404.html` (the SPA shell of spa-chiptune, the journal's 404 page), that page renders the example's instead, so deep links work. The playground also builds the WebAssembly compiler, which needs `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli --version 0.2.129 --locked` (the version must match the workspace's `wasm-bindgen` pin).

`.github/workflows/pages.yml` runs the same build on every push to `main` (or manually) and deploys `dist/site` to GitHub Pages, with the base taken from the Pages configuration. To enable it, set **Settings > Pages > Source** to **GitHub Actions** on the repository.

## License

[MIT](LICENSE). This covers the Lumen packages, the website and all examples, except third-party code kept under its own license, such as the gbapu engine vendored in `examples/spa-dotmatrix/vendor/gbapu` and the Remix 3 benchmark entry.

## Contributing

Setup, the CI workflows and how the compiler binaries are built: [CONTRIBUTING.md](CONTRIBUTING.md).
