# Security

> A strict Content Security Policy, with nonces and hashes, from one option, and a cross-site check on every form action.

## Concept

### Strict CSP from one option

With `csp: "strict"`, the browser runs only the scripts and applies only the styles the page
meant to include, so injected markup cannot run code. Every `create-lumiose` template sets it;
the framework default is off, so a project set up by hand opts in.

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";

export default { plugins: [lumiose({ csp: "strict" })] };
```

```text
Content-Security-Policy: script-src 'nonce-…'
  'strict-dynamic'; style-src 'self' 'nonce-…';
  object-src 'none'; base-uri 'self';
  frame-ancestors 'self'
```

- **Pages rendered per request** get a new random nonce for each response, on every inline
  `<script>` and `<style>` that Lumiose or your JSX wrote, and this header (one line). They also
  get `Cache-Control: private, no-store` unless the page sets its own.
- **Prerendered pages** get the policy as a `<meta>`, with the SHA-256 hash of each inline script
  and style. Browsers ignore `frame-ancestors` there: send it, or `X-Frame-Options: SAMEORIGIN`,
  as a header.
- **`style` props and `style="…"` strings** render as rules of a nonce'd or hashed `<style>`, not
  as attributes.
- **Raw HTML strings** (`innerHTML`) never get a nonce or a hash: a script injected through one
  is blocked.
- **Your own policy wins**, and `lumiose dev` sends no policy.

All of it, with `cspNonce()`:
[Strict Content Security Policy](../reference/security.md#strict-content-security-policy).

### Values that cannot run code

Text is escaped. A `javascript:`, `vbscript:` or `data:text/html` URL from a dynamic value renders
as `about:blank#blocked` ([LUM4009](../errors/LUM4009.md)). A spread drops `innerHTML`,
`textContent`, `srcdoc` and lowercase `on*` keys, so an object from JSON cannot inject markup.

```tsx check
export function Profile(props: {
  bio: string;
  site: string;
  attrs: JSX.HTMLProps<HTMLParagraphElement>;
}) {
  return (
    <p {...props.attrs}>
      {props.bio}
      <a href={props.site}>Website</a>
    </p>
  );
}
```

> **Warning:** `<Dynamic component="div">` takes its props as written ones: it applies
> `innerHTML`, `textContent` and `srcdoc` from them. Never spread an object from JSON, or any
> other untrusted object, into `Dynamic`.

> **Details:** [Unsafe URLs](../reference/security.md#unsafe-urls) and
> [Client navigation and spread props](../reference/security.md#client-navigation-and-spread-props):
> `navigate()` and the redirects of enhanced form actions only follow `http:` and `https:` URLs.

### Raw HTML and JSON

`innerHTML={…}` and an iframe's `srcdoc={…}` render a string as HTML, as it is: a script in it
runs. Pass them only HTML you trust, your own or sanitized. Write JSON for a `<script>` as a text
child: every `<` is written as `\u003c`, so a value cannot close the element.

```tsx check
export function ArticleData(props: { title: string }) {
  const data = () => ({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: props.title,
  });
  return <script type="application/ld+json">{JSON.stringify(data())}</script>;
}
```

> **Details:** [Raw HTML](../reference/security.md#raw-html) (`sandbox` for frames you do not
> control) and how the text of any `<script>` or `<style>` is escaped:
> [JSON and raw text](../reference/security.md#json-and-raw-text-in-script-and-style).

### Redirects

`redirect()` accepts paths and `http(s)` URLs only; a `javascript:` or `data:` location throws.
For a user-supplied target (`?next=`), accept only same-origin paths, or the user lands wherever
a link sends them.

```ts
// A `next` parameter as a path of this site.
function safeNext(next: string | null, fallback = "/") {
  if (next === null || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
redirect(safeNext(url.searchParams.get("next")));
```

> **Details:** trailing-slash and i18n redirects always stay on your site, and `href()` refuses
> `.` and `..` as param values: [Redirects](../reference/security.md#redirects).

### On by default

Each line links to its rules.

- **[Cross-site form posts](../reference/security.md#cross-site-form-posts):** form actions and
  form-encoded posts to endpoints are checked against the `Origin` header (`lumiose({ csrf })`).
- **[Request body limits](../reference/security.md#request-body-limits):** forms, JSON and other
  bodies stop at 1 MB, `multipart/form-data` at 10 MB, with `413 Payload Too Large`. Change them
  with `lumiose({ limits })` or a route's `export const limits`.
- **[Request URLs](../reference/security.md#request-urls):** built from the server's origin, so
  a request cannot choose another host. Behind a proxy that rewrites the host, set `ORIGIN`.
- **[Default response headers](../reference/security.md#default-response-headers):**
  `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- **[Server-only code](../reference/security.md#server-only-code)** (`*.server.*`, `src/server/`)
  never reaches the browser (`LUM4003`), and only `PUBLIC_*` variables reach client code.
- **[What the page sends](../reference/security.md#what-the-page-sends):** island props, values
  awaited in islands and scoped state are readable by anyone who loads the page. Never pass a
  secret there.
- **[Secrets](../reference/security.md#secrets):** `signedCookie()` needs a secret of at least
  32 bytes in production (`LUMIOSE_SECRET`).
- **[Error details](../reference/security.md#error-details):** in production server rendering,
  `<ErrorBoundary>` fallbacks get a generic error with a `digest`.
- **[Files from elsewhere](../reference/security.md#files-from-elsewhere):** SVG imports are
  sanitized as untrusted input. Markdown and HTML imports are trusted author files, compiled as
  written: never put end-user content in them.
- **[Compression](../reference/security.md#compression):** BREACH, for pages that render a secret
  next to reflected input.

## API

| Option / export                              | Meaning                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| `lumiose({ csp: "strict" })`                 | Nonces per response, the policy header, hash policies. |
| `cspNonce(): string \| undefined`            | The response's nonce, for markup the app builds.       |
| `<meta property="csp-nonce">`                | Written by Lumiose; the client reads the nonce there.  |
| `lumiose({ csrf })`                          | The cross-site check of form posts (on by default).    |
| `lumiose({ limits })`, `export const limits` | Request body limits, for the app or a route.           |
| `lumiose({ headers })`                       | Response headers, your own policy included.            |

## Example

An inline script that runs before the first paint. On a server-rendered page Lumiose gives it the
response's nonce; on a prerendered page the page's policy lists its hash.

```tsx
// src/document.tsx
import type { DocumentProps } from "lumiose";

const THEME = `document.documentElement.dataset.theme =
  localStorage.getItem("theme") ?? "auto"`;

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

## Common mistakes

- **An inline script built as a string.** Only elements written in JSX get the nonce. Write a
  JSX `<script>`, add `nonce={cspNonce()}` to markup you build, or load the code as a module.
- **A client-only `<style>` inside an `<svg>` on a prerendered page.** No nonce exists there: put
  the rules in the file's `<style>` block.
- **Expecting the policy in `lumiose dev`.** Check with `lumiose build` and `lumiose preview`.
- **Adding `'unsafe-inline'`.** It disables the protection for every inline script.

The long forms: [Common mistakes](../reference/security.md#common-mistakes).

## Related diagnostics

A CSP violation shows in the browser console, with the refused element. For files:
[LUM1009](../errors/LUM1009.md) (content nested too deeply), [LUM3014](../errors/LUM3014.md) (CSS
nested too deeply), [LUM3021](../errors/LUM3021.md) (a `$` constant that would break out of its
value).

See also: [Head and document](head.md), [Styles](styles.md), [Rendering modes](rendering-modes.md), [reference: `@lumiose/vite`](../reference/vite.md), [reference: app APIs](../reference/app.md).
