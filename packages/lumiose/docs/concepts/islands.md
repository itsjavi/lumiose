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
| `client:idle`                               | When the browser is idle (at the latest after 2 s). |
| `client:visible` / `client:visible="200px"` | When it enters the viewport (optional root margin). |
| `client:media="(max-width: 600px)"`         | When the media query matches.                       |
| `client:only`                               | Client-rendered only: no server HTML.               |

**Props must be serializable**: JSON values plus `undefined`, `NaN`/`Infinity`, `BigInt`, `Date`,
`URL`, `Map` and `Set`. Functions, symbols, class instances (a `Response` too), promises and cycles
are `LUM4002`.

**Children and JSX props are slots.** They are rendered on the server and stay server components:
they never ship their own JS. A slot the island rendered on the server is adopted in place when it
hydrates; one it did not render yet (behind a condition) is sent as `<template data-l-slot="name">`
and inserted when the island renders it.

**What hydration does.** The island's component runs again in the browser, with the props the
server serialized, and its compiled code claims the server's nodes instead of creating new ones:
the DOM, focus and text selections stay. Awaits replay the values recorded during SSR instead of
fetching again, while still tracking what they read, so a later change re-runs the component and
fetches. Everything outside islands stays server HTML that never hydrates. `client:only` renders on
the client without server HTML. An island inside a streamed `<Suspense>` waits for its content
before hydrating.

**Nested directives.** A `client:*` inside an island's own render is just a component: it is
already client-side.

**Server-only boundaries.** `*.server.ts` files and everything under `src/server/` may not be
imported from code that reaches the browser (`LUM4003`): keep database access, secrets and
`env()` there. `lumiose dev` and `lumiose build` fail with the chain of importers when the client graph
reaches one, and `lumiose check` reports the import. Server-only APIs (`request()`, `cookies()`,
`env()`, …) throw `LUM4003` in the browser build.

**Awaited data** inside an island is recorded during SSR and replayed during hydration, so the
browser does not fetch it again; it must be plain data (`LUM4007`), and it is visible in the page
source. The loader and `hydrate()` are described in [`lumiose/dom`](../reference/dom.md).

**The loader script.** `lumiose dev` and `lumiose build` add the loader to every page that renders an
island, once, as `<script type="module" async>`: in the `<head>` when the shell has islands,
otherwise with the first streamed chunk that does. In a build, pages without islands load no
JavaScript; the loader is the client entry, and each island is a chunk it imports when the island's
trigger fires. The loader's chunk also holds the Lumiose runtime the islands share (signals, DOM,
hydration), so a page loads one runtime file before its islands: about 9 to 10 kB min+brotli in
the sample apps (`pnpm --filter lumiose size:apps` reports them; the runtime's 10 kB cap is checked by
`pnpm --filter lumiose size`). With your own server, pass its URL as
`renderToStream(root, { loaderUrl })`.

**Build output.** `lumiose build` puts the Lumiose runtime in one chunk: the island loader's, the SPA
entry's when the app has no islands, or a shared `lumiose-[hash].js` when it has both. The router's
History API fallback is a separate chunk, loaded only by browsers without the Navigation API. Dynamic
imports go through a smaller preload helper than Vite's: it still adds the imported chunk's
stylesheets (and waits for them, skipping those the page already holds in its merged or inline
styles), module preloads and the CSP nonce of `<meta property="csp-nonce">`, but dispatches no `vite:preloadError` event (the router loads the
URL with a document navigation when a page's module does not load).

**Islands from other packages.** Components of a linked workspace package (`"@acme/ui": "workspace:*"`)
can be or render islands too. Island records name modules without build-machine paths:
root-relative inside the project (`/src/components/LikeButton.stsx#LikeButton`), package-relative
outside it (`@acme/ui/src/Nav.stsx#Nav`), or by the import's bare name
(`import { Nav } from "@acme/ui"` gives `@acme/ui#Nav`). Either way, the `modulepreload` hint of a
`client:load` island points at its chunk in a build and at Vite's URL of the module in dev. Builds
also look for island call sites in the linked packages that depend on `lumiose`, so each of their
islands gets its chunk even when only server code renders it. Folders inside such a package that
are projects of their own (with a `package.json`, `tsconfig.json` or `vite.config.*`, such as a
showcase app) are left out.

> **Status:** available: island calls and records (`LUM4001`, `LUM4002`), the loader with its
> triggers and event replay, and hydration (`LUM4006` on a mismatch), in `lumiose dev` and builds.

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
import { signal } from "lumiose";

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
import { params } from "lumiose";
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
- **Expecting `submit()` to refresh the page.** On MPA pages a successful `submit()` does not
  reload: the island owns its state and updates itself from the result. Call `invalidate()` when
  the page needs fresh server HTML ([Data and actions](data-and-actions.md)).
- **Making a whole page an island to get interactivity.** Mark only the interactive parts, or use
  an `spa` route ([Rendering modes](rendering-modes.md)).

## Related diagnostics

- [LUM4001](../errors/LUM4001.md): island component is not exported.
- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4004](../errors/LUM4004.md): browser API at module scope.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.

See also: [Rendering modes](rendering-modes.md), [Async components](async.md), [Sharing state](state.md) (state shared by islands).
