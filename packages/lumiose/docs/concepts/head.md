# Head and document

> Set head content with `<Title>`, `<Meta>` and `<Head>` from any component. Lumiose renders `<html>`, `<head>` and `<body>` for you; `src/document.stsx` customizes them.

## Concept

**Head components.** `<Title>`, `<Meta>` and `<Head>` can be used in any component, layout or page.
There is no `meta` export: these components are the one way to set head content.

- `<Title>`: the deepest one wins, so a page overrides its layouts and the document.
- `<Meta name="…" content="…" />`: attributes as in HTML. Metas with the same `charset`, `name`,
  `property`, `http-equiv` or `itemprop` dedupe: the deepest one wins, and the previous value comes
  back when it is removed.
- `<Head>`: any other head elements (`<link>`, `<script>`). Elements already in `<head>` are not
  duplicated.

**On the server** they are collected while the shell renders and flushed into `<head>`. Inside a
streamed `<Suspense>` boundary they are too late (`LUM5004`). **In the browser** (islands, SPA)
they update `document.title` and `<head>` live, and are removed with their component.

**Document.** By default Lumiose renders the HTML document. `src/document.stsx` takes over
`<html>`, `<head>` and `<body>`: it receives `{ head, body }` and must render each once. It renders
like any component, so it can provide context to pages. `{props.head}` also carries the page's
stylesheets, preload hints and island loader. `{props.body}` is followed by the page's island records
and its streamed `<Suspense>` content, so the whole page stays inside `<body>` with either document.

**Head defaults.** The `<title>` and `<meta>` tags the document writes in its `<head>` are defaults,
the shallowest level of the head: a `<Title>` replaces the title, and a `<Meta>` replaces the tag
with the same `charset`, `name`, `property`, `http-equiv` or `itemprop`, where the document put it.
Each page gets one of each, in complete and streamed responses. The default document's `charset` and
`viewport` tags work the same way. The document renders on the server only, so after an SPA
navigation a default that a page replaced does not come back: defaults that SPA pages fall back to
belong in their outermost `spa` layout, as `<Title>`/`<Meta>`.

> **Status:** available on the server (`renderToStream`) and in the browser; the default and custom
> documents are rendered by the request handler.

## API

| API                     | Use                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `<Title>{text}</Title>` | The document title; the deepest wins, over the document's `<title>`.                |
| `<Meta … />`            | A `<meta>` tag, keyed by `charset`, `name`, `property`, `http-equiv` or `itemprop`. |
| `<Head>…</Head>`        | Other head elements.                                                                |
| `DocumentProps`         | `{ head, body }`: props of `src/document.stsx`.                                     |

## Example

```stsx check file=document.stsx
// src/document.stsx: the title and description are defaults that pages replace
import type { DocumentProps } from "lumiose";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>A Lumiose site</title>
        <meta name="description" content="A Lumiose site" />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
```

```tsx check file=routes/about.tsx
// src/routes/about.tsx
import { Head, Meta, Title } from "lumiose";

export default function About() {
  return (
    <main>
      <Title>About us</Title>
      <Meta name="description" content="Who we are" />
      <Head>
        <link rel="canonical" href="https://example.com/about" />
      </Head>
      <h1>About us</h1>
    </main>
  );
}
```

## Common mistakes

- **A `meta` or `title` export.** There is none; render `<Title>` and `<Meta>`.
- **`<Title>` inside `<Suspense>`** on a server route: the head was already sent (`LUM5004`). Set
  it in the page body outside the boundary.
- **Rendering `props.head` or `props.body` twice** in `document.stsx`. Render each exactly once.
- **Writing `<title>` or `<meta>` elements directly in a page.** They land in the body. Use the
  components.
- **Setting `document.title` in an effect.** It fights with `<Title>`; use the component.

## Related diagnostics

- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.

See also: [Rendering modes](rendering-modes.md), [reference: components](../reference/components.md).
