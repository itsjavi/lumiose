# Head and document

> Set the page's title and meta tags from any component, and customize the HTML document around your app.

## Concept

### Title and meta

`<Title>`, `<Meta>` and `<Head>` work in any component, layout or page. The deepest `<Title>`
wins, and so does the deepest `<Meta>` of a `name`. There is no `meta` export.

```tsx check file=routes/about/page.tsx
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

### The document

`src/document.stsx` takes over `<html>`, `<head>` and `<body>`. It renders `props.head` and
`props.body` once each. Its `<title>` and `<meta>` tags are defaults that pages replace.

```stsx check file=document.stsx
import type { DocumentProps } from "lumiose";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <title>A Lumiose site</title>
        <meta name="description" content="A Lumiose site" />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
```

> **Details:** dedupe keys, the server and the browser, what `props.head` carries, head defaults
> after SPA navigations, raw-text escaping and the status:
> [Head and document in detail](../reference/components.md#head-and-document-in-detail).

## API

| API                     | Use                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `<Title>{text}</Title>` | The document title; the deepest wins, over the document's `<title>`.                |
| `<Meta … />`            | A `<meta>` tag, keyed by `charset`, `name`, `property`, `http-equiv` or `itemprop`. |
| `<Head>…</Head>`        | Other head elements.                                                                |
| `DocumentProps`         | `{ head, body }`: props of `src/document.stsx`.                                     |

Signatures: [Title](../reference/components.md#title), [Meta](../reference/components.md#meta),
[Head](../reference/components.md#head).

## Example

JSON-LD for a page, from its data. `{JSON.stringify(data)}` is safe in a `<script>`, even with
data users wrote.

```tsx check file=routes/books/page.tsx
import { Head, Title } from "lumiose";

const book = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: "Dune",
};

export default function Books() {
  return (
    <main>
      <Title>{book.name}</Title>
      <Head>
        <script type="application/ld+json">{JSON.stringify(book)}</script>
      </Head>
      <h1>{book.name}</h1>
    </main>
  );
}
```

## Common mistakes

Each in full:
[Head and document in detail](../reference/components.md#head-and-document-in-detail).

- **A `meta` or `title` export.** There is none; render `<Title>` and `<Meta>`.
- **`<Title>` inside `<Suspense>`** on a server route: the head was already sent (`LUM5004`).
- **Rendering `props.head` or `props.body` twice** in `document.stsx`.
- **`<title>` or `<meta>` elements in a page.** They land in the body.
- **Setting `document.title` in an effect.** It fights with `<Title>`.
- **Escaping JSON for a `<script>` yourself.** Write `{JSON.stringify(data)}`.

## Related diagnostics

- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.

See also: [Rendering modes](rendering-modes.md), [reference: components](../reference/components.md).
