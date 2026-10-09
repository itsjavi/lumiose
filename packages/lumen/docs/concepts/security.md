# Security

> `lumen({ csp: "strict" })` sends a strict Content Security Policy: a fresh nonce on every inline script and style Lumen writes, `cspNonce()` for your own, and hashes for prerendered pages. Form actions are also checked against cross-site posts.

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
- **Your own inline scripts and styles** need the nonce: `<script nonce={cspNonce()}>`.
  `cspNonce()` returns the response's nonce during a server render (the document included) and in
  middleware, and `undefined` without strict CSP or while prerendering, where the hash covers the
  element.
- **Your own policy wins.** A `Content-Security-Policy` header from `lumen({ headers })` for the
  path, or one set with `response().setHeader()` or by middleware, replaces Lumen's; with `headers`,
  the path's prerendered pages get no `<meta>` policy either. `lumen dev` puts nonces on the page but sends no policy,
  because Vite injects styles of its own for hot updates.

Not covered by the policy: `style="…"` attributes written as plain strings in markup that the
compiler keeps static, `<style>` elements inside an `<svg>` (native SVG CSS) and inline styles in
`.md`/`.html` imports. Move such CSS into a `<style>` block of the file.

**Cross-site form posts.** Form actions and form-encoded posts to endpoints are checked against
the `Origin` header (on by default, `lumen({ csrf })`); see [Data and actions](data-and-actions.md).

## API

| Option / export                   | Meaning                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| `lumen({ csp: "strict" })`        | Nonces per response, the policy header, hash policies for prerendered pages |
| `cspNonce(): string \| undefined` | The response's nonce (from `lumen`), for the app's own inline scripts       |
| `<meta property="csp-nonce">`     | Written by Lumen with the nonce; the client's preload helper reads it       |

## Example

```ts
// vite.config.ts
import lumen from "lumen/vite";

export default { plugins: [lumen({ csp: "strict" })] };
```

```tsx
// src/document.tsx: an inline script that runs before the first paint
import { cspNonce, type DocumentProps } from "lumen";

const THEME = `document.documentElement.dataset.theme = localStorage.getItem("theme") ?? "auto"`;

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <script nonce={cspNonce()} innerHTML={THEME} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
```

On a server-rendered page the script carries the nonce; on a prerendered page `cspNonce()` is
`undefined` and the page's policy lists the script's hash.

## Common mistakes

- **An inline script without the nonce.** The browser refuses it, and logs a CSP violation. Add
  `nonce={cspNonce()}`, or load the code as a module.
- **`<style>` inside an `<svg>`.** It is an inline style, kept as written. Put the rules in the
  file's `<style>` block.
- **Expecting the policy in `lumen dev`.** Dev sends none; check with `lumen build` and
  `lumen preview` or your server.
- **Adding `'unsafe-inline'` to make an error go away.** It disables the protection for every
  inline script. Find the element in the console message and give it the nonce instead.

## Related diagnostics

None yet: a violation shows in the browser console, with the refused element.

See also: [Head and document](head.md), [Styles](styles.md), [Rendering modes](rendering-modes.md), [reference: `lumen/vite`](../reference/vite.md), [reference: app APIs](../reference/app.md).
