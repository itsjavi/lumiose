# Security

> `lumen({ csp: "strict" })` sends a strict Content Security Policy: a fresh nonce on every inline script and style Lumen writes and on those you write in JSX, `cspNonce()` for markup you build yourself, and hashes for prerendered pages. Form actions are also checked against cross-site posts.

## Concept

**Strict Content Security Policy.** A strict CSP lets the browser run only the scripts and apply
only the styles the page meant to include, so injected markup cannot run code. With
`lumen({ csp: "strict" })`:

- **Pages rendered per request** (`server` routes, `spa` routes that reach the server) get a new
  random nonce for each response. Every inline `<script>` and `<style>` Lumen writes carries it:
  the page's stylesheets that are inlined (see [Styles](styles.md)), the island loader, the
  streamed `<Suspense>` swaps, the speculation rules, the View Transitions opt-in and module
  preloads. The response gets this header:

  ```
  Content-Security-Policy: script-src 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; object-src 'none'; base-uri 'self'
  ```

  `'strict-dynamic'` lets the scripts the page loads import their own modules (islands, SPA
  routes). Stylesheets from your own origin are allowed; inline styles need the nonce. These
  responses also get `Cache-Control: private, no-store` unless the page sets its own: a nonce is
  only secret while no shared cache hands the same HTML to someone else.

- **Prerendered pages** (`static` routes, the shells of `spa` pages) are files that every visitor
  gets as they are, so a nonce would be the same for everyone. Each one gets the policy as
  `<meta http-equiv="Content-Security-Policy">`, first in `<head>`, with the SHA-256 hash of each
  inline script and style that Lumen or your JSX wrote (the same ones that get a nonce per
  request) and `'self'` for scripts and stylesheets of your origin. It works on any static host.
- **`style` props** render as rules of a nonce'd (or hashed) `<style>` that target a `data-l-v`
  attribute, instead of `style="…"` attributes, which a strict policy refuses. In the browser,
  styles are set through the CSSOM, which the policy allows.
- **Your own inline scripts and styles** written in JSX get the nonce automatically: a
  `<script innerHTML={…}>` in the document, a JSON-LD block, an SVG `<style>`. An explicit `nonce`
  prop wins. Strings rendered as text are escaped and never become elements, and raw HTML strings
  (`innerHTML` of another element) never get a nonce, nor a hash on prerendered pages: a script
  injected through such a string is blocked either way.
- **Static `style="…"` strings** (in JSX, and in `.md`/`.html` imports) are applied like `style`
  props: a nonce'd rule on the server, the CSSOM in the browser.
- **`cspNonce()`** returns the response's nonce during a server render (the document included) and
  in middleware, and `undefined` without strict CSP or while prerendering. Use it for markup you
  build yourself: a third-party snippet as a string, a custom `Content-Security-Policy` header, a
  script you create at runtime. In the browser it reads `<meta property="csp-nonce">`.
- **Your own policy wins.** A `Content-Security-Policy` header from `lumen({ headers })` for the
  path, or one set with `response().setHeader()` or by middleware, replaces Lumen's; with `headers`,
  the path's prerendered pages get no `<meta>` policy either. `lumen dev` puts nonces on the page but sends no policy,
  because Vite injects styles of its own for hot updates.

Elements that the client creates later (a `<style>` inside an `<svg>` rendered after a client
navigation) take the nonce from `<meta property="csp-nonce">`. A prerendered page has no nonce,
so such an element is refused there unless it was in the prerendered HTML: put its rules in the
file's `<style>` block.

**Client navigation.** `navigate()` and the redirects of enhanced form actions only
follow `http:` and `https:` URLs (relative ones included); a `javascript:` or `data:` location
throws a `TypeError` instead of running in the page. Spread props drop lowercase `on*` keys
(`{...{ onclick: "…" }}`): an inline handler attribute is a script sink, so handlers are only
functions in `onClick`.

**Unsafe URLs.** A dynamic value for a URL attribute (`href`, `src`, `action`, `formaction`,
`xlink:href`, `poster`, `data`, …) whose scheme is `javascript:`, `vbscript:` or `data:text/html`
renders as `about:blank#blocked`, on the server and in the browser, with a
[LUM4009](../errors/LUM4009.md) warning in development. Case, leading spaces and control
characters, and tabs or newlines inside the scheme do not get past it. String literals in your JSX
are left as written.

**Error details.** In production server rendering, `<ErrorBoundary>` fallbacks receive a generic
error with a short `digest`, and the original error is logged with the same digest
([ErrorBoundary](../reference/components.md#errorboundary)).

**Redirects.** `redirect()` accepts paths and `http(s)` URLs only; a `javascript:` or `data:`
location throws. For a user-supplied target (`?next=`), accept only same-origin paths, or the user
lands wherever a link sends them:

```ts
// A `next` parameter as a path of this site, else the fallback.
function safeNext(next: string | null, fallback = "/"): string {
  if (next === null || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
redirect(safeNext(url.searchParams.get("next")));
```

Trailing-slash redirects (`lumen({ trailingSlash })`) always stay on your site, also for a
request path such as `//evil.com/`. `href()` refuses `.` and `..` as param values, which a browser
would resolve into another route.

**Files from elsewhere.** Icon sets, Markdown and HTML often come from outside the project. The
compiler treats them as untrusted input:

- **SVG imports** keep an allowlist of SVG elements and attributes: no scripts, handlers,
  `<foreignObject>` HTML, `javascript:` URLs or animations of links, and `<style>` text cannot
  open a tag ([SVG imports](svg.md)).
- **`$` constants** in style blocks cannot end their declaration or the `<style>` element
  ([LUM3021](../errors/LUM3021.md)), so data in a constant cannot add CSS outside its scope.
- **Frontmatter** keys such as `__proto__` stay plain data.
- **Depth limits** turn absurdly nested files into errors instead of crashes or stalls: CSS
  blocks past 64 levels and parentheses past 16 ([LUM3014](../errors/LUM3014.md)), SVG elements past 128,
  Markdown and HTML past 512 ([LUM1009](../errors/LUM1009.md)).

**Cross-site form posts.** Form actions and form-encoded posts to endpoints are checked against
the `Origin` header (on by default, `lumen({ csrf })`); see [Data and actions](data-and-actions.md).

**Request URLs.** `lumen dev`, `lumen preview` and `@lumen/adapter-node` build each request's URL
from the server's origin (`ORIGIN`, else the socket's protocol and the `Host` header) plus the
request target's path, appended as is: a request for `//attacker.test/reset` stays on your origin
with that path, so `ctx.url`, `url()`, the cross-site check and `fetchJSON()`'s same-origin test
never see another host. Targets that are not a path (`http://other/x`, or `*` other than with
`OPTIONS`) and invalid `Host` headers get `400 Bad Request`. Behind a proxy that rewrites the
host, set `ORIGIN` (or the adapter's `origin`) so a client cannot choose the origin through `Host`.

**Request body limits.** Every request body is bounded (decision-29): URL-encoded forms, JSON and
other bodies at 1 MB, `multipart/form-data` (uploads) at 10 MB. A larger request gets `413 Payload
Too Large`, refused before reading when its `Content-Length` says so, else as soon as the bytes
read pass the limit; nothing buffers an unbounded body. The limits hold for form actions
(`ctx.formData()`), endpoints (`request.formData()`, `json()`, `text()`, `arrayBuffer()` read the
bounded body) and middleware alike, in every deployment. Raise or lower them for the app with
`lumen({ limits: { body: "2mb", upload: "50mb" } })`, and for one route with
`export const limits = { upload: "200mb" }` in its page or endpoint file.

**Default response headers.** `X-Content-Type-Options: nosniff` (no MIME sniffing of uploads and
JSON) and `Referrer-Policy: strict-origin-when-cross-origin` (no full URLs to other sites) go on
every response; override them in `lumen({ headers })`, or remove one with `""`.

**Server-only code** (`*.server.*` files, `src/server/`) never reaches the browser: imports from
client code fail `lumen dev`/`lumen build` (`LUM4003`), `lumen dev` refuses to serve the files
(`server.fs.deny`), and only `import.meta.env.PUBLIC_*` variables reach client code (`envPrefix`).
See [Server](server.md).

**Secrets.** `signedCookie()` needs a secret of at least 32 bytes in production
(`LUMEN_SECRET`); a shorter one throws when the cookie is used (in development it warns).
`{ allowWeakSecret: true }` opts out.

**Compression.** `@lumen/adapter-node` compresses responses; for pages that render a secret next
to reflected input, see BREACH in the [adapter reference](../reference/adapter-node.md).

## API

| Option / export                   | Meaning                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `lumen({ csp: "strict" })`        | Nonces per response, the policy header, hash policies for prerendered pages |
| `cspNonce(): string \| undefined` | The response's nonce (from `lumen`), for markup the app builds itself       |
| `<meta property="csp-nonce">`     | Written by Lumen with the nonce; the client's preload helper reads it       |

## Example

```ts
// vite.config.ts
import lumen from "lumen/vite";

export default { plugins: [lumen({ csp: "strict" })] };
```

```tsx
// src/document.tsx: an inline script that runs before the first paint
import type { DocumentProps } from "lumen";

const THEME = `document.documentElement.dataset.theme = localStorage.getItem("theme") ?? "auto"`;

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <script innerHTML={THEME} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
```

On a server-rendered page Lumen gives the script the response's nonce; on a prerendered page the
page's policy lists the script's hash.

## Common mistakes

- **An inline script built as a string** (`<div innerHTML={'<script>…</script>'}>`, a snippet
  added at runtime). Lumen only nonces elements written in JSX: the browser refuses it and logs a
  CSP violation. Write it as a JSX `<script>`, add `nonce={cspNonce()}` to the markup you build,
  or load the code as a module.
- **A `<style>` inside an `<svg>` that only the client renders, on a prerendered page.** No nonce
  exists there. Put the rules in the file's `<style>` block.
- **Expecting the policy in `lumen dev`.** Dev sends none; check with `lumen build` and
  `lumen preview` or your server.
- **Adding `'unsafe-inline'` to make an error go away.** It disables the protection for every
  inline script. Find the element in the console message and give it the nonce instead.

## Related diagnostics

A CSP violation shows in the browser console, with the refused element. For files:
[LUM1009](../errors/LUM1009.md) (content nested too deeply), [LUM3014](../errors/LUM3014.md) (CSS
nested too deeply), [LUM3021](../errors/LUM3021.md) (a `$` constant that would break out of its
value).

See also: [Head and document](head.md), [Styles](styles.md), [Rendering modes](rendering-modes.md), [reference: `lumen/vite`](../reference/vite.md), [reference: app APIs](../reference/app.md).
