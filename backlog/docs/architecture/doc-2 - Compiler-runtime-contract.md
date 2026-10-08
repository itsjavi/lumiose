---
id: doc-2
title: Compiler-runtime contract
type: specification
created_date: '2026-10-08 12:27'
updated_date: '2026-10-08 15:52'
tags:
  - architecture
  - contract
---
# Compiler-runtime contract

> **Owner:** Lux. **Task:** TASK-6. **Consumers:** Photon (compiler, TASK-9/10/14/15) and Spark (runtime, TASK-13/16/17/18).
>
> **Typed source of truth:**
> - `packages/lumen/src/contract/client.ts` (`ClientRuntime`, from `lumen/dom`)
> - `packages/lumen/src/contract/server.ts` (`ServerRuntime`, from `lumen/server`)
>
> This doc gives the semantics and golden examples. **Change process:** propose a change in your task notes, then Lux updates this doc and the typed files, and both sides adapt in the same milestone.

## 1. Principles

- **Imports.** Compiled output imports runtime helpers only from `lumen/dom` (client) or `lumen/server` (server), plus public APIs from `lumen` that the user's own code already imports.
- **One client walk.**
  - The compiler emits a single client code path: clone, then walk with `firstChild`/`nextSibling`.
  - Hydration is pluggable. Importing `lumen/dom/hydrate` (done by the island loader and by SPA hydrate entries) installs a claim cursor. While the cursor is active, `template()` factories and the `insert`, `list` and `branch` helpers adopt existing DOM instead of creating it.
  - Bundles without islands or SSR never contain the hydration code.
  - This amends spec v0.3 §5.2, which described a separate `_tN.h` walk: equal tree-shaking, simpler codegen.
- **Hoisting.** The compiler hoists everything static to module scope: templates, `apply` functions, static SSR string parts, selector setup where possible, and delegated event name lists.
- **Scope tokens are attributes** (`data-l-<hash>`) baked into template HTML. Runtime class handling never touches them.
- **Props are getter objects.**
  - Static literal props are plain values.
  - Dynamic props become `get name() { return expr; }`.
  - `children` is always a getter.
  - The hidden `$$scope` prop carries the caller's scope tokens when `class` is passed.

## 2. Client runtime (`lumen/dom`)

| Name | Contract |
|---|---|
| `template(html, flags?)` | Parse once into `<template>`. The factory clones `content.firstChild`, or all roots when `flags & MultiRoot`. `Svg` and `MathMl` set the namespace. HTML is minified and may omit optional closing tags. `<!>` is a placeholder comment |
| `bind(target, compute, apply)` | Tracked `compute`; calls `apply(target, value)` only when the value changes (`Object.is`). The first run applies immediately. Disposed with the owner |
| `setText`, `setAttr`, `setProp`, `setClass`, `toggleClass`, `setStyle`, `setStyleProperty` | Pure DOM writers, usable as `apply` functions. For `setAttr`: nullish or `false` removes the attribute, `true` sets `""` |
| `insert(parent, value, marker?)` | Renders `Renderable` before `marker`. Functions and signals are tracked and reconciled. Arrays are flattened. Nodes are moved, not cloned. Strings become text nodes. `null`, `undefined` and booleans render nothing |
| `list(parent, marker, source, render, key?)` | Keyed reconciliation (spec §6.3). `render.length > 1` means the index is used, so a per-row index signal is created. Each row's owner is created lazily |
| `branch(parent, marker, cond, whenTrue, whenFalse?)` | Memoised on `!!cond()`. Disposes the inactive branch's owner |
| `selector(source)` | Returns `isSelected(key)`. Only the previous and the next key re-notify |
| `createComponent(C, props)` | New owner, untracked call. A native `async function` takes the async path (§4) |
| `restProps(props, keys)`, `mergeProps(...)`, `spread(el, () => props)` | Reactive props utilities |
| `applyScope(el, tokens)` | Sets each `data-l-*` token in `tokens` as an empty attribute |
| `delegateEvents(names)` | Document-level, idempotent. Dispatch calls `el.$$name(e)`, or `el.$$name(el.$$nameData, e)` when a data slot exists. It stops at the boundary of an island or app root, and respects `cancelBubble` |
| `listen(el, name, handler, options?)` | `addEventListener` plus cleanup |
| `bindValue`, `bindChecked` | Effect writes the property, and the `input`/`change` listener sets the signal |
| `attach(el, () => list)` | Each attachment runs in a tracked scope; its cleanup runs on re-run or disposal |
| `useRef(el, ref)` | Calls `ref(el)` synchronously after the element is created |
| `$await(thunk, site)`, `$leave()` | §4 |

**Components and helpers that compiled code reaches through `lumen` (public):**
- `Suspense`, `ErrorBoundary`, `Portal`, `Dynamic`;
- `signal`, `computed` and the rest of the reactive core;
- `lifetime`, `pending`, `fetchJSON`.

## 3. Server runtime (`lumen/server`)

**`SSRNode`.** `SSRNode = { t: string }` is escaped HTML. A plain string hole is always escaped as text.

| Name | Contract |
|---|---|
| `ssr(parts, ...holes)` | Interleaves parts and holes. Sync unless a hole is a thenable, in which case it returns `Promise<SSRNode>` and resolves holes concurrently while preserving order |
| `text(v)` | Escaped text. Inside islands, it emits `<!--!-->` between adjacent dynamic texts (the compiler passes adjacency through its parts) |
| `insert(v)` | Dynamic region. Inside islands it is wrapped as `<!--[-->…<!--]-->`; outside islands it is unwrapped |
| `attr`, `classAttr`, `styleAttr`, `spreadAttrs`, `escape` | Attribute serialization. `styleAttr` follows the CSP mode (spec §7.4) |
| `list(source, render)` | Joins rows; inside islands, markers as on the client |
| `branch(cond, a, b?)` | Inside islands it emits `<!--[-->` for the active branch or `<!--[!-->` for the inactive one |
| `selector(source)` | Evaluated once |
| `createComponent(C, props)` | Runs in a context frame (owner-like: context, request scope, boundary, island flag). Async components return promises |
| `island(ref, C, props, strategy, strategyValue?, slots?)` | Emits island markers, inline slot markers for the slots the island renders, `<template data-l-slot>` for the others, the serialized record, and the `modulepreload` hint for `load` |
| `$await(thunk, site)`, `$leave()` | Same shape as the client (§4). Awaits. Inside an island it records `{ [instancePath:site:occurrence]: value }`, which must be plain data or it raises `LUM4007` |

**Public server variants** come from `lumen` under the `node` condition, with the same names: `renderToStream`, `renderToString`, `Suspense`, `ErrorBoundary`, `Head`/`Title`/`Meta`, and request accessors.

### 3.1 Hydration markers (inside islands only)

Inside `<!--l:ID-->…<!--/l:ID-->`, the server marks every range the client claims. Blocks nest, and `<!--]-->` closes the nearest open `<!--[-->` or `<!--[!-->`. Claim order is creation order, the same on both sides (Nova, TASK-47).

| Marker | Server emits it for | Client counterpart |
|---|---|---|
| `<!--[-->…<!--]-->` | `insert`, `list`, the active branch | The helper's region |
| `<!--[!-->…<!--]-->` | The inactive branch | The region (`whenFalse`) |
| `<!--!-->` | Between adjacent `text()` holes | Text split |
| `<!--[-->…<!--]-->` | Each async component instance | Its range (`createAsync`) |
| `<!--[-->…<!--]-->` | `<Suspense>`: around the content, or around `<?start name="lbN">fallback<?end>`, which the streamed content replaces | The Suspense range; hydrates once its chunk has arrived |
| `<!--[-->…<!--]-->` / `<!--[!-->…<!--]-->` | `<ErrorBoundary>`: its children / a server-rendered fallback | Its range; `[!` means render afresh rather than claim |
| `<!--l:s:NAME-->…<!--/l:s-->` | A slot the island rendered (for every read) | The slot's nodes, adopted |
| `<template data-l-slot="NAME">` | A slot the island did not render; emitted once, right after `<!--l:ID-->` | Inserted when the island renders it |

**Await records** have the shape `{ "path:site:occurrence": value }`. The island root is instance `0`. Each instance numbers the components created in its body, boundaries included, in creation order and across awaits (for example `0.1.2`).

**Template/server alignment** (Photon, TASK-14):
- The server never emits the client's `<!>` placeholders. Inside islands, each client `insert`/`list`/`branch` corresponds to exactly one marker region, in the same child order.
- A `text()` hole whose value is `""` renders no text node, so the hydrator must create one.

## 4. Async components (both sides)

- **Async marking.** The compiler wraps every async component definition as `export const X = $async(async function X(props) { … })`, using `$async` from `lumen/dom` or `lumen/server`. `createComponent` dispatches on the `$async` tag, so bundles without async components tree-shake the async path (about 0.7 kB, measured by Spark in TASK-17). `instanceof AsyncFunction` remains only as a dev-mode fallback: an untagged async component, such as one from a library compiled without Lumen, gets a warning and still works.
- **Rewrite.** Only awaits whose nearest enclosing function is the component are rewritten:
  - `await e` becomes `(await $await(() => e, N))()`, where `N` is the 0-based static site index in source order. `$await` pauses the run synchronously and resolves to a resume function. Calling it in the component's own continuation restores the run and returns the value. Resuming inside the runtime's `.then` would be unsound, because another run's continuation can interleave (found by Spark in TASK-7).
  - The whole body is wrapped as `try { … } finally { $leave(); }`, so the run is paused synchronously when the body returns or throws.
  - `$await` never rejects. If the thunk rejects, it resolves to a resume function that restores the run and then throws the error. This keeps `try/catch` blocks in the component running with context restored (Nova, TASK-16). Client and server behave the same way.
  - `for await (const x of it)` is lowered to a loop of `(await $await(() => iter.next(), N))()`.
- **Client semantics** (spec §4.4):
  - Each run gets a fresh run subscriber.
  - `$await` pauses it before awaiting and resumes it after, with the owner and context restored.
  - A superseded run's `lifetime()` aborts.
  - The new UI swaps the old range atomically, and the old owner is disposed at that point.
- **Replay key.** `instancePath:site:occurrence`.
  - `instancePath` is the island-relative creation index path of component instances.
  - `occurrence` counts executions of the same site within one run.

## 5. Golden examples

These are illustrative: exact variable names are free, but the structure and the imports are normative.

### 5.1 Counter (static and dynamic text, delegated event, class object, scoped style)

```tsx
// Counter.stsx
import { signal } from "lumen";
export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);
  return (
    <button class={{ hot: count() > 5 }} onClick={() => count.update((c) => c + 1)}>
      Clicked {count()} times
      <style>.hot { color: crimson; }</style>
    </button>
  );
}
```

```js
// client
import { signal } from "lumen";
import { template, bind, toggleClass, insert, delegateEvents } from "lumen/dom";
import "/src/Counter.stsx?lumen&type=style&lang.css";
const _t0 = template(`<button data-l-c1>Clicked <!> times`);
const _a0 = (el, v) => toggleClass(el, "hot", v);
export function Counter(props) {
  const count = signal(props.start === undefined ? 0 : props.start);
  const _el = _t0();
  bind(_el, () => count() > 5, _a0);
  _el.$$click = () => count.update((c) => c + 1);
  insert(_el, count, _el.firstChild.nextSibling);
  return _el;
}
delegateEvents(["click"]);
```

```js
// server
import { signal } from "lumen";
import { ssr, classAttr, insert } from "lumen/server";
const _s0 = ["<button data-l-c1", ">Clicked ", " times</button>"];
export function Counter(props) {
  const count = signal(props.start === undefined ? 0 : props.start);
  return ssr(_s0, classAttr({ hot: count() > 5 }), insert(count()));
}
```

```css
.hot[data-l-c1] { color: crimson; }
```

### 5.2 Keyed list with selector and a data-slot event

```tsx
{rows().map((row) => (
  <tr class={{ danger: selected() === row.id }}>
    <td><a onClick={() => select(row.id)}>{row.label()}</a></td>
  </tr>
))}
```

```js
const _t1 = template(`<tr data-l-x><td data-l-x><a data-l-x> `);
const _isSel = selector(selected);                          // hoisted into component setup
list(_tbody, null, rows, (row) => {
  const _tr = _t1(), _a = _tr.firstChild.firstChild;
  bind(_tr, () => _isSel(row.id), _aDanger);
  _a.$$click = _selectHandler; _a.$$clickData = row.id;     // closure hoisted: captures only row
  bind(_a.firstChild, row.label, setText);
  return _tr;
});
// module scope: const _selectHandler = (id) => select(id)  — select must be a module/setup-stable reference;
// when the closure captures other setup locals, the compiler keeps a per-row closure instead.
```

### 5.3 Component call with props, children and class passthrough

```tsx
<Card title={post().title} class="featured">{post().body}</Card>
```

```js
insert(_el, createComponent(Card, {
  get title() { return post().title; },
  class: "featured",
  $$scope: "data-l-p1",
  get children() { return post().body; },
}), _marker);
// inside Card, where it applies props.class:
bind(_root, () => props.class, setClass); applyScope(_root, props.$$scope);
```

### 5.4 Async component

```tsx
export async function Member({ id }: { id: string }) {
  const m = await fetchJSON(`/api/members/${id}`);
  return <h3>{m.name}</h3>;
}
```

```js
export async function Member(props) {
  try {
    const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
    const _el = _t2();
    _el.firstChild.data = m.name;        // m is a plain value after await, so this is a one-time write
    return _el;
  } finally {
    $leave();
  }
}
```

### 5.5 Island call site (server)

```tsx
<TeamPanel client:visible ids={ids}>{<p>footer</p>}</TeamPanel>
```

```js
island("/src/components/Team.stsx#TeamPanel", TeamPanel, { ids }, "visible", undefined,
       { children: () => ssr(_s9) });
```

On the client build, `client:*` is removed, and the component is referenced only through the island manifest entry.

## 6. Diagnostics shared with runtime dev checks

| Codes | Where they are raised |
|---|---|
| `LUM4002`, `LUM4007` | Serialization, at runtime in dev and at build time on a best-effort basis |
| `LUM4006` | Hydration mismatch, at runtime in dev |
| `LUM4008` | Module-scope signal written during SSR, at runtime in dev |

Runtime errors include the code plus a docs URL (`https://lumen.dev/errors/LUMxxxx`; the URL is a placeholder until publishing).
