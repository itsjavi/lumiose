# `lumiose/dom`

> `render` renders a component tree into a DOM element. The rest of `lumiose/dom` is the client half of the compiler-runtime contract that compiled code imports.

## render

```ts
function render(code: () => JSX.Element, container: Element): () => void;
```

Renders `code()` into `container` (appended after its existing content) under a new root owner, and
marks the container as a delegation boundary. Returns a disposer that disposes the owner and
removes the rendered nodes. With the Vite plugin, an entry module that imports `render` re-renders
the app on hot updates. Solid's `render` has the same signature.

## Compiler-runtime contract

`template`, `bind`, `insert`, `insertText`, `branch`, `list`, `selector`, `createComponent`, `mergeProps`,
`restProps`, `spread`, `delegateEvents`, `listen`, `attach`, `bindValue`, `bindChecked`,
`useRef`, `$async`, `$await`, `$leave` and friends are what the compiler emits calls to. They are
not an application API and may change between versions; write JSX instead.

## `lumiose/dom/hydrate`

```ts
function hydrate<P extends object>(
  component: Component<P>,
  props: P,
  start: Node,
  end: Node,
  awaits?: Record<string, unknown>,
  slots?: readonly string[],
  fresh?: boolean,
): () => void;
```

Hydrates the server-rendered range between the comments `start` and `end` (an island's
`<!--l:ID-->` and `<!--/l:ID-->`): it renders `component` with `props`, and the compiled code
claims the server's nodes instead of creating new ones, so element identity, focus and text
selections survive. Returns a disposer.

- **Awaits are replayed.** `awaits` maps each first-run `await` of an async component to the value
  the server recorded (`"instancePath:site:occurrence"` keys), so hydration does not fetch again.
  The awaited expression still runs for tracking, with its fetch held off: when a signal it reads
  changes later, the component re-runs and fetches as usual.
- **Slots** (`slots`, the names of children and JSX props) become props holding the server's HTML:
  the nodes rendered inline (`<!--l:s:NAME-->…<!--/l:s-->`) are adopted where the island renders
  the slot; a slot the server did not render comes from its `<template data-l-slot="NAME">` when
  the island renders it later.
- **Mismatch.** When the client renders a different structure than the server's (another branch,
  element or list length), the island is disposed, its range cleared and rendered on the client;
  in dev, [LUM4006](../errors/LUM4006.md) is logged. A missing await record makes the client await
  again (also LUM4006 in dev).
- `fresh` (`client:only`) renders on the client without claiming.

Importing `lumiose/dom/hydrate` also installs the hydration cursor that the compiled walk uses. Only
the island loader and hydrating entries import it; bundles that never hydrate do not include it.

## `lumiose/dom/loader`

The island loader: a client entry, with no exports, that `lumiose dev` and `lumiose build` add to every
page that renders an island (`<script type="module" async>`, see [Islands](../concepts/islands.md));
with your own server, pass its URL as `renderToStream(root, { loaderUrl })`. It imports the app's
island manifest (`virtual:lumiose/islands`, from `@lumiose/vite`), and:

- reads the island records (`<script type="application/json" data-l-islands>`) as each streamed
  chunk arrives, and finds each island's range;
- arms its trigger: `client:load` and `client:only` at once, `client:idle` on
  `requestIdleCallback` with a 2 s timeout (a busy main thread cannot leave the island inert), `client:visible` when the range's first element intersects the viewport
  (the value is the `rootMargin`), `client:media` when the query matches;
- waits for an island whose range still holds a streamed `<Suspense>` fallback until its content
  (and the await records sent with it) arrives;
- imports the island's module and calls `hydrate()`;
- catches `click`, `input`, `submit` and `keydown` on an island that is not hydrated yet: it
  hydrates that island at once and dispatches the events again on their targets afterwards (an
  `input` restores the value typed meanwhile).

Islands inside slots that an island inserts later are hydrated when they appear.

## Example

```tsx check
import { signal } from "lumiose";
import { render } from "lumiose/dom";

function App() {
  const name = signal("world");
  return <input bind:value={name} placeholder={`Hello, ${name()}`} />;
}

render(() => <App />, document.getElementById("app")!);
```
