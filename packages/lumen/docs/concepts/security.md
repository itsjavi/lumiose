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
  routes). Stylesheets from your own origin are allowed; inline styles need the nonce.

- **Prerendered pages** (`static` routes, the shells of `spa` pages) are files that every visitor
  gets as they are, so a nonce would be the same for everyone. Each one gets the policy as
  `<meta http-equiv="Content-Security-Policy">`, first in `<head>`, with the SHA-256 hash of each
  of its inline scripts and styles and `'self'` for scripts and stylesheets of your origin. It
  works on any static host.
- **`style` props** render as rules of a nonce'd (or hashed) `<style>` that target a `data-l-v`
  attribute, instead of `style="…"` attributes, which a strict policy refuses. In the browser,
  styles are set through the CSSOM, which the policy allows.
- **Your own inline scripts and styles** written in JSX get the nonce automatically: a
  `<script innerHTML={…}>` in the document, a JSON-LD block, an SVG `<style>`. An explicit `nonce`
  prop wins. Strings rendered as text are escaped and never become elements, and raw HTML strings
  (`innerHTML` of another element) never get a nonce. On prerendered pages the hash covers them.
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

**Cross-site form posts.** Form actions and form-encoded posts to endpoints are checked against
the `Origin` header (on by default, `lumen({ csrf })`); see [Data and actions](data-and-actions.md).

**Request URLs.** `lumen dev`, `lumen preview` and `@lumen/adapter-node` build each request's URL
from the server's origin (`ORIGIN`, else the socket's protocol and the `Host` header) plus the
request target's path, appended as is: a request for `//attacker.test/reset` stays on your origin
with that path, so `ctx.url`, `url()`, the cross-site check and `fetchJSON()`'s same-origin test
never see another host. Targets that are not a path (`http://other/x`, or `*` other than with
`OPTIONS`) and invalid `Host` headers get `400 Bad Request`. Behind a proxy that rewrites the
host, set `ORIGIN` (or the adapter's `origin`) so a client cannot choose the origin through `Host`.

**Request body limits.** `ctx.formData()` in a form action reads at most 1 MB of URL-encoded
fields and 16 MB of multipart data, and every request body through `lumen dev`, `lumen preview`
and `@lumen/adapter-node` at most 16 MB: a larger body gets `413 Payload Too Large`, refused before
reading when its `Content-Length` says so, else as soon as the count passes the limit. Nothing
buffers an unbounded body. (These defaults are fixed for now.)

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

None yet: a violation shows in the browser console, with the refused element.

See also: [Head and document](head.md), [Styles](styles.md), [Rendering modes](rendering-modes.md), [reference: `lumen/vite`](../reference/vite.md), [reference: app APIs](../reference/app.md).
