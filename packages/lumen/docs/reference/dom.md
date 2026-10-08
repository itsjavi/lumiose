# `lumen/dom`

> `mount` renders a component tree into a DOM element. The rest of `lumen/dom` is the client half of the compiler-runtime contract that compiled code imports.

## mount

```ts
function mount(code: () => JSX.Element, container: Element): () => void;
```

Renders `code()` into `container` (appended after its existing content) under a new root owner, and
marks the container as a delegation boundary. Returns a disposer that disposes the owner and
removes the rendered nodes. With the Vite plugin, an entry module that imports `mount` re-mounts on
hot updates.

## Compiler-runtime contract

`template`, `bind`, `insert`, `branch`, `list`, `selector`, `createComponent`, `mergeProps`,
`restProps`, `spread`, `delegateEvents`, `listen`, `attach`, `bindValue`, `bindChecked`,
`useRef`, `$async`, `$await`, `$leave` and friends are what the compiler emits calls to. They are
not an application API and may change between versions; write JSX instead.

## `lumen/dom/hydrate`

Importing `lumen/dom/hydrate` installs the hydration cursor that makes the compiled walk claim
server-rendered nodes. The island loader and SPA entries import it; bundles that never hydrate do
not include it.

## Example

```tsx check
import { signal } from "lumen";
import { mount } from "lumen/dom";

function App() {
  const name = signal("world");
  return <input bind:value={name} placeholder={`Hello, ${name()}`} />;
}

mount(() => <App />, document.getElementById("app")!);
```
