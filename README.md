# Lumiose

**Feels like React. Runs like vanilla JS.**

Lumiose is a web framework for every kind of web app, from static sites to SPAs: TSX with scoped CSS built in, signals, and 0 kB of JavaScript where pages don't move. The framework docs live in [`packages/lumiose/docs/`](packages/lumiose/docs/).

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

The website is assembled into one static site: `apps/web` (the landing page at `/`, the docs at `/docs`, the `/examples` and `/benchmarks` pages, and the playground at `/playground`), the example apps that need no server (`examples/spa-chiptune`, `spa-dotmatrix`, `ssg-travel-journal` and `vite-counter`, at `/examples/<name>/`), the fullstack benchmark's results viewer with the committed results (`/benchmarks/fullstack/`) and the Lumiose js-framework-benchmark app (`/benchmarks/js-framework-benchmark/app/`).

```sh
pnpm build:site                  # builds the compiler, the website and the examples into dist/site
pnpm build:site --base /lumiose/   # served below a path, e.g. a GitHub project page
pnpm preview:site --base /lumiose/ # serves dist/site at http://localhost:4173/lumiose/
```

`--skip-compiler` reuses an existing native compiler build. Each example gets `PUBLIC_LUMIOSE_SITE` (the site's base) and shows a small "Made with Lumiose" link back to the site when it is set; the static benchmark viewers get the same link. GitHub Pages answers every missing path with the root `404.html`; below an example that has its own `404.html` (the SPA shell of spa-chiptune, the journal's 404 page), that page renders the example's instead, so deep links work. The website's build also builds the playground's WebAssembly compiler (`apps/web/scripts/playground-assets.ts`), which needs `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli --version 0.2.129 --locked` (the version must match the workspace's `wasm-bindgen` pin). `pnpm demo web` builds it too when the toolchain is installed; without it the rest of the site runs and the playground page reports the missing compiler.

`.github/workflows/pages.yml` runs the same build on every push to `main` (or manually) and deploys `dist/site` to GitHub Pages, with the base taken from the Pages configuration. To enable it, set **Settings > Pages > Source** to **GitHub Actions** on the repository.

## License

[MIT](LICENSE). This covers the Lumiose packages, the website and all examples, except code vendored with its own notice: the gbapu Game Boy APU engine in `examples/spa-dotmatrix/vendor/gbapu` (by the same author, MIT release planned) and the Remix 3 benchmark entry (Apache-2.0).

## Contributing

Setup, the CI workflows and how the compiler binaries are built: [CONTRIBUTING.md](CONTRIBUTING.md).
