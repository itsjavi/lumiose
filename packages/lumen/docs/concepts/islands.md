# Islands

> Pages render on the server and ship no JS by default. Add a `client:*` directive where a component is used, and only that component (an island) hydrates in the browser.

## Concept

An **island** is a component instance that runs in the browser. You declare it at the **usage
site**, so the same component can be static on one page and interactive on another:

```tsx
<TeamPanel client:visible ids={ids} />
```

On the server, the call compiles to an island record: the component's module and export name, its
props, its slots and the hydration strategy. The page HTML contains the server-rendered island
between comment markers (`<!--l:ID-->…<!--/l:ID-->`) plus a JSON record; a small loader (about 1
kB) reads the records, arms the triggers and imports the island's module when one fires. Clicks,
input, submits and key presses that happen before hydration are replayed.

**Directives** (components only):

| Directive                                   | Hydrates                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `client:load`                               | Immediately.                                        |
| `client:idle`                               | When the browser is idle.                           |
| `client:visible` / `client:visible="200px"` | When it enters the viewport (optional root margin). |
| `client:media="(max-width: 600px)"`         | When the media query matches.                       |
| `client:only`                               | Client-rendered only: no server HTML.               |

**Props must be serializable**: JSON values plus `undefined`, `NaN`/`Infinity`, `BigInt`, `Date`,
`URL`, `Map` and `Set`. Functions, symbols, class instances (a `Response` too), promises and cycles
are `LUM4002`.

**Children and JSX props are slots.** They are rendered on the server into
`<template data-l-slot="name">` inside the island and inserted when the island renders the slot.
They stay server components: they never ship their own JS.

**Nested directives.** A `client:*` inside an island's own render is just a component: it is
already client-side.

**Server-only boundaries.** `*.server.ts` files and everything under `src/server/` may not be
imported from code that reaches the browser (`LUM4003`): keep database access, secrets and
`env()` there.

**Awaited data** inside an island is recorded during SSR and replayed during hydration, so the
browser does not fetch it again; it must be plain data (`LUM4007`), and it is visible in the page
source.

> **Status:** the compiler emits island calls for `client:*` and checks `LUM4001`; the server
> renders island markers, slots and records. The browser-side loader and hydration are in
> progress, so islands render on the server but do not hydrate yet.

## API

| API                                                                           | Use                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `client:load`, `client:idle`, `client:visible`, `client:media`, `client:only` | Make a component instance an island.                                  |
| `export function X`                                                           | Islands must be exported, so the browser can import them (`LUM4001`). |
| `*.server.ts`, `src/server/**`                                                | Server-only modules.                                                  |
| `import.meta.env.PUBLIC_*`                                                    | Env values that may reach islands.                                    |

## Example

```stsx check file=components/LikeButton.stsx
// src/components/LikeButton.stsx: an island; exported so the browser can import it
import { signal } from "lumen";

export function LikeButton({ initial, children }: { initial: number; children?: JSX.Element }) {
  const likes = signal(initial);

  return (
    <button class="like" onClick={() => likes.update((n) => n + 1)}>
      {children} {likes()}

      <style>
        .like { border-radius: 999px; }
      </style>
    </button>
  );
}
```

```stsx check file=routes/posts/[id].stsx
// src/routes/posts/[id].stsx: a server component; only LikeButton ships JS
import { params } from "lumen";
import { LikeButton } from "../../components/LikeButton.stsx";

export default function Post() {
  const { id } = params<"/posts/[id]">();

  return (
    <main>
      <h1>Post {id}</h1>
      <LikeButton client:visible initial={3}>
        <strong>Like</strong>
      </LikeButton>
    </main>
  );
}
```

## Common mistakes

- **A non-exported island.** `function Counter` used with `client:load` cannot be imported by the
  browser. Export it (`LUM4001`).
- **Passing functions or class instances as island props.** `onSave={() => …}` cannot be
  serialized. Pass data, and do the work inside the island, or post a form (`LUM4002`).
- **Importing server code into an island.** `import { db } from "../server/db.server.ts"` in an
  island's graph is `LUM4003`. Call an endpoint with `fetchJSON` instead.
- **Touching `window` or `document` at module scope** in a module that also runs on the server.
  Move it into `onMount` or an effect (`LUM4004`).
- **Different output on server and client**, for example from `Math.random()` or `Date.now()` in
  render. Hydration reports `LUM4006` in dev and client-renders the range in production.
- **Making a whole page an island to get interactivity.** Mark only the interactive parts, or use
  an `spa` route ([Rendering modes](rendering-modes.md)).

## Related diagnostics

- [LUM4001](../errors/LUM4001.md): island component is not exported.
- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4004](../errors/LUM4004.md): browser API at module scope.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.

See also: [Rendering modes](rendering-modes.md), [Async components](async.md).
