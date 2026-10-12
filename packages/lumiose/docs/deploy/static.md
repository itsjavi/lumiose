# Static hosts

> Deploy a site whose every route is prerendered: `dist/client` is the whole site, for GitHub Pages, Cloudflare, Netlify, S3 with CloudFront or any file server.

`lumiose build` writes no `dist/server` when no route renders per request (no `server` route, no
`spa` route rendered on the server per request, no form action): see
[Rendering modes](../concepts/rendering-modes.md). What `dist/client` holds:

- the pages as `path/index.html` (`path.html` with `lumiose({ trailingSlash: "never" })`), and
  `404.html`, rendered from your root `not-found` page;
- `assets/`, named by content hash: cache them for a year (files you put in `public/assets/` are
  not hashed: keep them elsewhere in `public/`, or out of the long cache);
- `_headers`: Lumiose's default headers and `lumiose({ headers })` in the format Netlify and
  Cloudflare read;
- a `.br` and a `.gz` copy of every text file of 1 kB or more, for servers that serve
  precompressed files. Hosts that compress on their own serve them as plain files; leave them out of
  the upload there.

Set Vite's `base` when the site is served below a path (`base: "/my-repo/"` for a GitHub Pages
project site): links built with `href()` follow it.

How far each host's steps were checked is in the [verification table](README.md#verification).

## Cloudflare

Use the [Cloudflare adapter](cloudflare.md) even for a static site: it skips the precompressed
copies and adds a year of caching for the hashed files of `/assets/` to `_headers`. Without a server, the build writes
no Worker, and the wrangler config has assets only:

```jsonc
// wrangler.jsonc
{
  "name": "my-site",
  "compatibility_date": "2026-09-01",
  "assets": { "directory": "dist/client", "not_found_handling": "404-page" },
}
```

`pnpm wrangler deploy` uploads it. `not_found_handling: "404-page"` serves `404.html` with status
404 for unknown URLs. On Cloudflare Pages, `pnpm wrangler pages deploy dist/client` deploys the
same directory (Pages reads `_headers` and serves `404.html` by itself); add a
`dist/client/.assetsignore` with `*.br` and `*.gz` there, or build with the adapter.

## Netlify

Use the [Netlify adapter](netlify.md) and the same `netlify.toml`: for a static site the build
writes no function, and Netlify serves `404.html` and applies `_headers` by itself.

## GitHub Pages

Deploy `dist/client` with GitHub's Pages actions (set the repository's Pages source to "GitHub
Actions"). GitHub Pages serves `404.html` for unknown URLs and ignores `_headers`; it compresses
on its own.

```yaml
# .github/workflows/pages.yml
name: Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lumiose build
      - run: find dist/client -name "*.br" -o -name "*.gz" | xargs rm -f
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/client
      - id: deployment
        uses: actions/deploy-pages@v4
```

For a project site (`https://<user>.github.io/<repo>/`), build with `base: "/<repo>/"` in
`vite.config.ts`.

## S3 and CloudFront

Upload `dist/client` to the bucket with a long cache for the hashed assets and revalidation for the
rest, then let CloudFront compress (enable "Compress objects automatically") and answer unknown URLs
with `404.html` (a custom error response for 403 and 404, status 404):

```sh
aws s3 sync dist/client s3://my-bucket --delete \
  --exclude "*.br" --exclude "*.gz" --exclude "_headers" \
  --exclude "assets/*" --cache-control "public, max-age=0, must-revalidate"
aws s3 sync dist/client/assets s3://my-bucket/assets --delete \
  --exclude "*.br" --exclude "*.gz" --cache-control "public, max-age=31536000, immutable"
```

S3 serves `about/index.html` for `/about/` only from its website endpoint (or with a CloudFront
function that appends `index.html`). Headers from `lumiose({ headers })` go into a CloudFront
response headers policy.

## Any file server

nginx, Caddy or another server can serve `dist/client` as it is, `.br`/`.gz` copies included
(nginx's `brotli_static`/`gzip_static`, Caddy's `precompressed`). `lumiose preview` serves it
locally the way static hosts do.
