---
id: doc-1
title: Lumiose architecture specification
type: specification
created_date: '2026-10-08 10:28'
updated_date: '2026-10-10 00:23'
tags:
  - architecture
  - spec
---
# Lumiose architecture specification

> **Status:** v0.3, the implementation baseline. Owner: Lux (architect). Milestone: m-0. Tracking task: TASK-3.
>
> **Decisions:** 3–19 are accepted. Decisions 1 and 2 are superseded by 11 and 12. Syntax and DX decisions were approved by the user; other technical decisions were made by the architect under decision-16.
>
> **Naming:** the product is called Lumiose. The working package name is `lumiose` (decision-15), and it gets renamed before publishing.
>
> **Normative terms:** **must**, **should** and **may** are used in their usual specification sense. Code samples are normative for API shape, not for internals.
>
> **Changes from v0.2:** this version folds in Prism's review. Masking and scanner rules (§4.1), code generation for masked artifacts (§5.1), the shell-first streaming model (§7.3, decision-19), async replay keys (§4.4, §7.4), class passthrough (§4.6.2), the app-layer APIs needed by the sample apps (§8), editor takeover mode (§9.2), and the performance budgets (§11).

## 0. Summary

Lumiose is a TypeScript 7-first web framework.

- **Authoring.** Components live in `.stsx` files ("styled TSX"): TSX plus raw-CSS `<style>` blocks. Plain `.tsx` files work too.
- **Styles.** Styles are plain CSS. A block applies to whatever encloses it: a component, the file, or the whole app with `<style global>`. CSS can read JS constants as `$name`, inlined at build time.
- **Components and state.** A component's body runs once, as setup. State lives in signals: `count()`, `count.set(v)`. Any component may be `async`, on both server and client, with `<Suspense>`.
- **JSX.** JSX reads like React: `.map()`, ternaries, `onClick`. A Rust compiler (OXC + Lightning CSS) compiles it to cloned templates with fine-grained bindings for the client, and to string concatenation for the server.
- **Rendering.** Rendering is server-first. Pages ship zero JS by default. Islands are declared where they are used (`client:visible`), and routes can opt into SPA mode. The server sends the page shell first, then streams `<Suspense>` boundaries.
- **Platform.** Built on web standards and Vite 8, and agent-first: version-matched docs, stable diagnostics, JSON CLI output and an MCP server.

```tsx
// src/components/Team.stsx — two components with private styles, plus shared file styles
import { signal, lifetime, Suspense } from "lumiose";
import { fetchJSON } from "lumiose";
import { radius, BREAKPOINT } from "../design/tokens.ts";
import type { Member } from "../types.ts";

export function TeamPanel({ ids }: { ids: string[] }) {
  const selected = signal(ids[0]);

  return (
    <section class="panel">
      <nav>
        {ids.map((id) => (
          <button class={{ active: selected() === id }} onClick={() => selected.set(id)}>
            {id}
          </button>
        ))}
      </nav>

      <Suspense fallback={<p class="loading">Loading…</p>}>
        <MemberCard id={selected()} />
      </Suspense>

      <style>
        .panel { display: grid; gap: 1rem; }
        nav { display: flex; gap: 0.5rem; }
        .active { font-weight: 600; }
        @media (width < $BREAKPOINT) { nav { flex-direction: column; } }
      </style>
    </section>
  );
}

export async function MemberCard({ id }: { id: string }) {
  const member = await fetchJSON<Member>(`/api/members/${id}`, { signal: lifetime() });
  const kudos = signal(member.kudos);

  return (
    <article class="card">
      <h3>{member.name}</h3>
      <button onClick={() => kudos.update((n) => n + 1)}>👏 {kudos()}</button>

      <style>
        .card { padding: 1rem; border-radius: $radius.lg; }
      </style>
    </article>
  );
}

<style>
  button { font: inherit; cursor: pointer; }
</style>
```

```tsx
// src/routes/index.stsx — a server component; only the island ships JS
import { TeamPanel } from "../components/Team.stsx";
import { db } from "../server/db.server.ts";

export default async function Home() {
  const ids = await db.team.featuredIds();

  return (
    <main>
      <Title>Our team</Title>
      <h1>Our team</h1>
      <TeamPanel client:visible ids={ids} />

      <style>
        main { max-inline-size: 48rem; margin: 2rem auto; }
      </style>
    </main>
  );
}
```

## 1. Goals and non-goals

### Goals

1. **TS 7 first.** Stock TS 7 `tsc` type-checks everything through shadow TSX files (§9.1), with no plugins and no TypeScript API.
2. **First-class styles.** Plain CSS, scoped by placement, with `$name` constants and no CSS runtime.
3. **Performance.** Beat React on js-framework-benchmark and reach the class of Solid, Svelte 5, Vue Vapor and Marko 6. SSR throughput should match the class of the fastest string renderers.
4. **Rendering.** CSR, streaming SSR, SSG, islands and SPA, all from one component model.
5. **Ecosystem.** Vite 8 / Rolldown, Vitest, oxlint / ESLint, oxfmt / Prettier, Tailwind, CSS imports and CSS Modules, npm, and web components.
6. **Agent-first.** The obvious code is correct code, and every rule is machine-checkable.

### Non-goals for v1

- React compatibility.
- A virtual DOM.
- CSS-in-JS, or JS inside CSS.
- Sass inside `<style>`.
- Resumability.
- RPC server functions.
- Route loaders (decision-18).
- A React island adapter (revisit after the sample apps).
- Native mobile.

### 1.1 Positioning

| Framework | Gap Lumiose fills |
|---|---|
| Solid 2 | First-class scoped CSS; server-first islands |
| Svelte 5 / Vue Vapor | TSX instead of SFCs; TS 7 without Volar; several components per file, each with its own style scope |
| Remix 3 | Fine-grained performance (Remix uses a virtual DOM); real CSS |
| Astro 7 | One component model across server and client |
| Marko 6 | TSX familiarity |
| TSRX, Ripple, Octane | Only one syntax addition (`<style>`); stock TS 7 and linters keep working |

## 2. Design principles

1. **TSX plus `<style>`, nothing else.** The masking invariant (§4.1) must always hold.
2. **One obvious way.** Each concept has exactly one blessed API.
3. **Write it like React, run it like Solid.** Familiar idioms compile to fine-grained code. Idioms that would silently misbehave are reported as diagnostics.
4. **CSS is CSS and JS is JS.** The only bridges are `$name` constants (build time) and custom properties set through the `style` prop (runtime).
5. **Explicit boundaries.** Each of these is visible in the code:
   - server versus client (`client:*`);
   - style scope (placement and `global`);
   - tracked versus untracked (`untrack`).
6. **Web platform first.**
7. **Zero-cost abstractions.** Anything decidable at build time is decided at build time.
8. **Every rule is checkable.** Each rule maps to a type error, a `LUMxxxx` diagnostic (§5.4), or a lint rule.

## 3. System overview

```
       authoring: .stsx (TSX + raw-CSS <style>) · .tsx · .ts
               │                                   │
   Vite 8 ─ lumiose/vite (JS plugin, pre) ─┐         ├─ shadow TSX (.lumiose/shadow, same UTF-16 offsets) → stock tsc
   napi ─ @lumiose/compiler (Rust)         │         ├─ @lumiose/language-server: takeover proxy over TS 7 LSP + CSS LS
     lumiose_compiler: scan/mask → OXC parse → semantic → analyze → codegen(client|server)
     lumiose_css: $ref substitution → Lightning CSS → placement scopes → targets/minify
               │                    │                      │
     lumiose/dom (client)    lumiose/server (SSR, streaming)   CSS assets (built in the client env) + module→CSS manifest
               └──────── lumiose app layer: routes · document · endpoints · actions · router · prerender · adapters
   CLI `lumiose`: dev · build · preview · check · lint · fmt · typegen · routes · docs · explain · mcp
```

### 3.1 Repository layout

```
Cargo.toml (workspace)        pnpm-workspace.yaml        tsconfig.base.json (TS 7)
crates/
  lumiose_compiler/  stsx scanner + masking (UTF-8 & UTF-16), analysis, client/server/hydrate codegen, diagnostics
  lumiose_css/       Lightning CSS: $ref substitution, placement scopes, keyframes
  lumiose_napi/      napi-rs v3 bindings (+ wasm32-wasip1-threads fallback)
  lumiose_wasm/      wasm-bindgen build for the playground
packages/
  lumiose/           the package users install
    src/core/      signals, owners, context, scheduling, boundaries (isomorphic)
    src/dom/       client renderer: templates, bindings, events, lists, branches, hydrate walk
    src/server/    string SSR, shell + Suspense streaming, island records
    src/app/       routes, document, endpoints, actions, middleware, router (SPA), prerender, adapter API
    src/vite/      Vite plugin
    src/cli/       `lumiose` binary
    src/jsx/       JSX types (jsx-runtime)
    docs/          version-matched docs
  language-server/ · vscode/ · eslint-plugin/ · prettier-plugin/ · create/ · testing/ · adapter-node/
apps/              playground/ · docs/
examples/          spa-*/ · ssr-*/ · ssg-*/   (the three sample apps)
benchmarks/        js-framework-benchmark/ · ssr/ · agent-evals/
```

Users install `lumiose`. It provides the subpaths `lumiose`, `lumiose/dom`, `lumiose/server`, `lumiose/router`, `lumiose/jsx-runtime` and `lumiose/vite`, plus the `lumiose` binary.

## 4. Authoring model

### 4.1 File types, scanner and masking invariant (decisions 11, 14)

| Extension | Contents |
|---|---|
| `.stsx` | TSX plus raw-CSS `<style>` blocks (components with styles) |
| `.tsx` | Plain TSX. Raw CSS in a `.tsx` file is `LUM1006` ("rename to `.stsx`"). |
| `.ts` | Logic, tokens, server code, endpoints. |

#### Scanner

A single Rust scanner, exposed through napi and wasm to every tool, finds `<style>` blocks.

- **Lexer modes.** It keeps a stack of modes: JS, JSX tag, JSX text, JSX expression container, template literal, string, comment and regex. Inside JSX text, a quote such as the one in `Don't` does not start a string.
- **Where blocks are recognised.**
  - `<style` must be followed by whitespace or `>`.
  - It is recognised wherever a JSX element can start: at a top-level statement, as a JSX child, or in an expression position.
- **Attributes.** The only allowed attribute is `global`. Any other attribute (`lang`, `media`, …) is `LUM1005`.
- **Content.** Block content runs up to the first `</style>`. An unclosed `<style>` is `LUM1004`. CRLF line endings are preserved.
- **SVG.** A `<style>` inside an `<svg>` subtree is native SVG CSS: it is emitted verbatim, unscoped and not extracted, and is still masked for tools.

#### Placement

| Placement | Validity |
|---|---|
| Module top level | Valid. The file scope. Must come after the `const` declarations it references, otherwise `LUM3013`. Conventionally placed at the end of the file. |
| Child of an **intrinsic element or fragment** inside a component's static JSX, at any depth | Valid. The component scope. |
| Child of a component element (`<Suspense>`, `<Card>`) | `LUM3010`. Move it into an intrinsic element. |
| Inside `{…}` containers, conditionals or `.map()` callbacks | `LUM3010`. |
| As the only thing a component returns, or in an expression position (`return <style>`, `=> <style>`) | `LUM3011`. |

#### Masking invariant

The **masked TSX** must parse as valid TSX and keep identical offsets. It is produced like this:

1. Replace every block (from `<style …>` through `</style>`) with spaces, preserving line terminators.
2. A block in an expression position is an error case. It is masked to `null` followed by spaces, so parsing continues and the compiler reports `LUM3011`.
3. `$name` references are kept at their exact positions:
   - In a **top-level block**, `$` becomes `;`, and the first character after the reference that is not a newline also becomes `;`. This prevents automatic semicolon insertion from merging the reference with the next statement.
   - In a **block inside JSX**, `$` becomes `{`, and the first character after the reference that is not a newline becomes `}`. Such a character always exists, because the masked `</style>` follows.

There are two offset spaces:
- The shadow TSX for TypeScript masks per **UTF-16 code unit**.
- The compiler's own parse masks per **UTF-8 byte**.

The scanner produces both, so non-ASCII CSS (`content: "→"`) keeps both views exact.

**Golden test.** Masking any style-free TSX corpus must produce byte-identical output.

### 4.2 Components (decisions 3, 7)

- **What is a component.** A PascalCase function that returns JSX. A file may export many components.
- **Setup.** The body runs once per instance. Async components are covered in §4.4.
- **Props.**
  - Props are the single parameter. Dynamic props are passed as getters.
  - Destructured props stay reactive: the compiler rewrites them to `props.x` reads, with `undefined`-defaults and a reactive `...rest`.
- **Children.**
  - `children` is lazy. Inserting it twice is `LUM2005`; use a render prop for repeated rendering.
  - Named slots are ordinary props.
- **`ref`.** `ref` takes one kind of value: a callback `(el) => void`. `ref<T>()` returns such a callback that can also be read like a signal (`input()`).
- **Early returns.** A reactive early return in a sync component is `LUM2003`.

### 4.3 Reactivity API (decisions 3, 8)

| API | Shape |
|---|---|
| `signal(v, { equals? })` | Read with `s()`; write with `s.set(v)` or `s.update(fn)`; `s.peek()` |
| `computed(fn)` | `c()`. Lazy, cached and glitch-free |
| `effect(fn)` | Returns a disposer. Runs after DOM updates; `fn` may return a cleanup |
| `store(obj)` | Deep reactive proxy that you mutate directly |
| `untrack(fn)`, `batch(fn)`, `flushSync()` | |
| `onMount(fn)`, `onCleanup(fn)` | Owner-scoped |
| `lifetime()` | An `AbortSignal`. Aborted when the run is superseded or the owner is disposed. On the server, it is the request's signal |
| `pending()` | Inside an async component: whether its own re-run is in flight |
| `submitting(name?)`, `navigating()`, `busy()` | Form submissions in flight; SPA navigation in flight; app-wide summary of everything in flight (decision-20) |
| `createContext(d)`, `provide(ctx, v)`, `inject(ctx)` | Work across `await` |
| `resource(fetcher)` | Low-level on-demand loading |
| `fetchJSON<T>(url, init?)` | Isomorphic and data-only. Same-origin requests are served in-process during SSR |
| `<Suspense fallback>`, `<ErrorBoundary fallback={(err, retry) => …}>`, `<Portal mount>`, `<Dynamic component>` | Components |

### 4.4 Async components (decision-13)

**Await rewrite.** The compiler rewrites `await` only where the nearest enclosing function is the component itself; awaits inside handlers and callbacks are untouched.
- `await e` becomes `(await $await(() => e, site))()`, and the body is wrapped in `try { … } finally { $leave() }` (contract doc-2 §4).
- `for await (const x of it)` awaits each step through `$await`.
- `await using` is `LUM1007` in v1.

What `$await` does:
- It **pauses** the run's subscriber node before the await and resumes it afterwards. The owner, context and tracking are restored.
- Each run gets a **fresh subscriber node**, which keeps alien-signals' `depsTail` link reuse correct.
- On the server, it records the resolved value inside islands.
- During hydration, it replays the recorded value instead of evaluating `e`.

**Replay keys.** Records are keyed by `(instancePath, site, occurrence)`:
- `instancePath` is the island-relative creation path, for example `0.2.1`.
- `site` is the static await index.
- `occurrence` is a per-run counter, so loops and conditional awaits stay distinct.

Replay validates the key. On a mismatch, it evaluates `e`, and reports `LUM4006` in dev.

**Re-runs.**
- Props and signals read in the body, including after awaits, are tracked. A change re-runs the component.
- When a run is superseded, the previous run's `lifetime()` aborts. Its UI stays live until the new run resolves. The old owner is then disposed at the moment the range swaps atomically.
- Signals created in the body reset on each re-run.
- `pending()` is true while a re-run is in flight.
- `LUM2007` warns when a component reads its own signals in the body.
- `LUM2001` (stale derived value) does not apply to async components.

**Boundaries.**
- `<Suspense>` shows its fallback for new pending content: first load, and newly mounted branches.
- Re-runs of already-revealed components keep the stale UI.
- SPA navigations hold the old page until the new one is ready, like a transition.
- `<ErrorBoundary>` catches rejections.
- With no boundary:
  - on the server, the component is part of the shell (decision-19);
  - on the client, nothing renders until it resolves;
  - errors go to `_error`.

**Data.**
- Awaited values inside islands must be plain data, otherwise `LUM4007`.
- `fetchJSON()` returns plain data. A raw `Response` is not serializable, and the `LUM4007` fix suggests `fetchJSON`.
- Everything awaited inside an island reaches the client. The docs must say this.

### 4.5 JSX semantics (decisions 7, 17)

**Bindings.**
- Literals and plain identifiers are static.
- Calls and member access become fine-grained `effect(compute, apply)` bindings.
- `untrack()` opts an expression out.

**Compiled idioms** (no `<For>` / `<Show>`)

| Source | Compiled |
|---|---|
| `{xs().map((x, i) => <Row key={x.id}/>)}` | Keyed list. `key` is optional (items are keyed by reference otherwise). `i` becomes a reactive index only if it is used |
| `item.key === sig()` or `sig() === item.key` (also `!==`) inside `.map` | O(1) `selector()` |
| `{c() ? <A/> : <B/>}`, `{c() && <A/>}` | Memoised branch |
| `{fn()}` returning nodes, arrays or text | Dynamic insert |

**Elements**

| Feature | Rule |
|---|---|
| `class` | String, array, or `Record<string, boolean>`. `className` is a type error |
| `style` | A string, or an object with kebab-case keys including `--custom` properties. Each key is fine-grained |
| `onClick` | Delegated (decision-17) |
| `on:scroll` | Native listener |
| `bind:value`, `bind:checked` | Two-way binding to a writable signal |
| `attach={[fn]}` | `(el) => cleanup?` |
| `innerHTML` | The lint rule `no-unsafe-html` warns |
| `key` | Allowed on intrinsic elements and components |
| `client:*` | Components only (§7.2) |

### 4.6 Styles (decisions 12, 14)

#### 4.6.1 Placement decides scope

| Placement | Scope |
|---|---|
| Inside a component | Its enclosing element and everything written inside it (lexical subtree, including `.map` callbacks and JSX children passed there); a block directly under the root element covers the whole component; sibling subtrees and other components are not affected (decision-23) |
| File top level | Every template in the file |
| `<style global>` | The whole app, unscoped |

#### 4.6.2 Mechanics

**Tokens.**
- Each scope that has styles gets the token `data-l-<hash>`. The hash is a stable base36 hash of the root-relative path, plus the component name for component scopes.
- **Every element** in a scope's templates carries that scope's token, baked into the template HTML. No pruning, so dynamic classes always work.
- An element covered by both the file scope and a component scope carries both tokens.

**Selectors and ordering.**
- The last compound of each selector gets `[data-l-<hash>]`, placed before any pseudo-element. This is a (0,1,0) specificity bump.
- `:global(sel)` is left unscoped. `:deep(sel)` scopes only the left part of the selector.
- `@keyframes` names are scoped, and `animation` references are rewritten.
- Custom properties are not scoped.
- Within a file, file-level CSS comes first, then component blocks in source order.

**Class passthrough (tokens follow `class`).**
- At a component call site that passes `class`, the compiler also passes the hidden prop `$$scope` with the caller's tokens.
- Wherever the child applies `props.class` to an element (root or not, through `...rest` or explicitly), the runtime applies `$$scope` to that same element.
- This makes `.cta {}` in a parent style `<Button class="cta" />`, wherever Button puts the class.

#### 4.6.3 Global

`<style global>` emits unscoped CSS. It is usually placed in the root `_layout.stsx`.

#### 4.6.4 `$name` constants

Constants can be used in property values and in `@media`, `@container` and `@supports` preludes. They cannot be used in selectors (where `[attr$=…]` keeps its CSS meaning), in property names, or inside strings, comments or `url()`.

**What can be referenced.** The value must be statically evaluable:
- top-level `const`s in the file;
- `const`s in the enclosing component (component blocks only);
- `export const`s from `.ts`, `.tsx` or `.stsx` modules.

Statically evaluable means literals, template literals made of constants, simple arithmetic, and **object** members of `as const` objects. Array indexing (`$arr.0`) is not valid JS, so it is not supported.

**Diagnostics.**
- `LUM3008`: the referenced value is not a constant. The fix suggests using the `style` prop.
- `LUM3009`: `$brand-primary`. The fix suggests `$brand.primary`.
- `LUM3013`: a top-level reference appears before the `const` it reads.

**Substitution.** Strings are inserted verbatim and numbers as-is. Units are added with `calc($gap * 1px)`.

**Compile-time behaviour.**
- References are resolved with `oxc_semantic` on the masked AST, so scoping matches what TypeScript sees.
- Imports used only by `$` references are **removed from the JS output**. Their modules are tracked as CSS dependencies, so editing `tokens.ts` triggers CSS-only HMR.

**Tooling.** For CSS tools (the CSS language service, stylelint), each reference is replaced by a CSS identifier of the same length: `$radius.lg` becomes `_radius_lg`.

#### 4.6.5 Runtime values

Use `style={{ "--progress": pct() }}` together with `var(--progress)`.

#### 4.6.6 Pipeline

- All style modules are built in the **client** Vite environment, including those of server-only components. This avoids duplicate CSS and missing assets.
- The build emits a **module → CSS manifest**. SSR computes each route's `<link>` set from the route's static import graph, which includes components that stream later inside `<Suspense>`. Those links are flushed in the shell.
- In dev, CSS goes through Vite's CSS HMR.
- Diagnostics:
  - `LUM3005`: unused scoped selector;
  - `LUM3012`: a custom property is set but never read;
  - unknown classes (opt-in).

### 4.7 Types and tsconfig

```jsonc
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumiose",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "rootDirs": ["src", ".lumiose/shadow/src"],
    "types": ["lumiose/env"]
  },
  "include": ["src", ".lumiose/shadow", ".lumiose/types"]
}
```

**JSX types.**
- `lumiose/jsx-runtime` exports `JSX`, which is also declared globally by `lumiose/env`.
- `IntrinsicElements` cover the DOM and SVG maps with Lumiose props: `on*` / `on:*` events, `class`, `style`, `bind:*` and `key`. `style` is **omitted**, so writing `<style>` in a `.tsx` file is a type error.
- `IntrinsicAttributes` add `key` and `client:*`.
- `ElementType` accepts sync and async components (verified on TS 7.0.2).

**Shadow files.**
- Shadow files are deleted when their source is deleted.
- Bare `tsc` needs `lumiose typegen` to have run first. `lumiose check` runs it for you.

## 5. Compiler (decision-5)

### 5.1 Pipeline

```
.stsx → scanner (blocks, placements, $refs, masked UTF-8 + UTF-16) → oxc_parser(masked) → oxc_semantic
      → analyze (components, scopes, props, idioms, await sites, islands, $ref resolution incl. imports)
      → lumiose_css ($ref substitution → Lightning CSS → scope visitor → targets/minify → css + map)
      → codegen(client | server) → oxc_codegen + sourcemap → { code (JS), map, css, cssDeps, diagnostics, meta }
.tsx  → same pipeline without the scanner
```

**Handling the masked artifacts:**
- Delete the masked ranges of blocks **before** JSX whitespace normalisation, so a block between inline siblings doesn't leave a stray `" "` text node.
- Drop the reference nodes (`{ref}` children and `;ref` statements).
- Remove imports that only `$` references use.
- Map spans back to the original source. Offsets are identical, so the mapping is the identity.

**Output.**
- The compiler outputs **JS for both `.stsx` and `.tsx`**, with types stripped by OXC.
- The Vite plugin returns `moduleType: "js"`.
- Vite's own OXC JSX transform is disabled for Lumiose files.
- `node_modules` is excluded unless a package opts in.

**Engineering rules:**
- Pin `oxc_*` and `lightningcss` to exact versions, guarded by golden fixtures.
- Build on `VisitMut` + `AstBuilder` + `oxc_semantic`, and avoid `oxc_traverse`.
- The core crate is pure. Imported modules needed for constant folding are requested from the host.
- Use `@dom-expressions/compiler` (MIT) as a design reference and reuse from it selectively, with attribution.
- Emit an execution-contract trace for each expression (tracked / untracked / once / deferred).

### 5.2 Client output (illustrative)

```js
import { signal } from "lumiose";
import { template, insert, delegateEvents, $await, $component } from "lumiose/dom";
import "/src/components/Team.stsx?lumiose&type=style&lang.css";

const _t0 = /*#__PURE__*/ template(`<article class=card data-l-k3x9a2 data-l-f81c0q><h3 data-l-k3x9a2 data-l-f81c0q> </h3><button data-l-k3x9a2 data-l-f81c0q>👏 <!>`);
const _a0 = (el, v) => (el.data = v);                          // hoisted apply fns (memory)

export const MemberCard = $component(async function MemberCard(props) {
  const member = (await $await(() => fetchJSON(`/api/members/${props.id}`, { signal: lifetime() }), 0))();
  const kudos = signal(member.kudos);
  const _el = _t0(), _h3 = _el.firstChild, _btn = _h3.nextSibling;
  _h3.firstChild.data = member.name;                           // static after await → one-time write
  _btn.$$click = () => kudos.update((n) => n + 1);
  insert(_btn, kudos, _btn.lastChild);                         // signal passed directly as the source
  return _el;
});
delegateEvents(["click"]);
```

- **Hydration** is pluggable: compiled code has a single walk. Importing `lumiose/dom/hydrate` (done by the island loader and SPA hydrate entries) installs a claim cursor that `template()`, `insert`, `list` and `branch` honour, so bundles without hydration never contain that code (contract doc-2 §1).
- **CSS** is emitted in order: the file scope first, then component scopes.

### 5.3 Server output (illustrative)

```js
import { ssr, escape, $await, $component, signal, lifetime } from "lumiose/server";
export const MemberCard = $component(async function MemberCard(props) {
  const member = (await $await(() => fetchJSON(`/api/members/${props.id}`, { signal: lifetime() }), 0))();
  const kudos = signal(member.kudos);
  return ssr(_s0, escape(member.name), escape(kudos()));   // _s0: hoisted static string parts
});
```

- **`ssr` is sync-first.** Holes may be thenables, and the result is a string or a promise of one.
- Signals are plain cells on the server, and `computed` runs once.
- Context and boundaries use lightweight frames.
- Hydration markers are emitted only inside island subtrees.

### 5.4 Islands, diagnostics registry

**Islands.** `<X client:visible …/>` compiles to `island(ref, X, props, strategy, slot)` on the server, where `ref` is the module specifier plus `#export`. On the client, `client:*` is type-only.

**Diagnostics.** Each diagnostic has the shape `{ code, severity, message, span, labels, help, fix?, docs }`. Codes are stable forever and are listed in `crates/lumiose_compiler/src/diagnostics/registry.rs` (the single source of truth), which generates the docs pages.

| Range | Codes |
|---|---|
| 1xxx file format | 1001 syntax error · 1002 unsupported construct/target · 1003 scanner ambiguity · 1004 unclosed `<style>` · 1005 unknown `<style>` attribute · 1006 raw CSS in `.tsx` · 1007 `await using` in a component |
| 2xxx reactivity | 2001 stale derived value · 2002 write during render · 2003 reactive early return · 2004 component called as a function · 2005 children inserted twice · 2006 reactive index escapes · 2007 own signal read in an async body |
| 3xxx styles | 3005 unused selector · 3008 non-constant `$ref` · 3009 hyphenated `$ref` · 3010 misplaced `<style>` · 3011 `<style>` as root or in an expression · 3012 custom property set but never read · 3013 `$ref` before its declaration · 3014 CSS syntax error · 3015 invalid CSS ignored · 3016 invalid scope selector (`:global`/`:deep` misuse) |
| 4xxx islands / boundaries | 4001 non-exported island · 4002 non-serializable island prop · 4003 server-only module in a client graph · 4004 browser API at module scope · 4006 hydration mismatch · 4007 non-serializable awaited value · 4008 module-scope signal written during SSR |
| 6xxx tooling / config | 6001 tsconfig missing options required by Lumiose |
| 5xxx routing / server | 5001 request API used during prerender (use `mode = "server"`) · 5002 invalid route file · 5003 duplicate route · 5004 head or status change inside a streamed boundary · 5005 non-GET export in a static endpoint |

### 5.5 Distribution

- The napi-rs v3 platform packages are named `@lumiose/compiler-<platform>`, with a wasm fallback.
- The plugin `lumiose/vite` runs `enforce: "pre"` with a Rust-side filter on `/\.(stsx|tsx)$/`.
- It serves the CSS virtual modules, the CSS manifest and the island manifest.
- HMR remounts instances. Edits that touch only CSS stay CSS-only.

## 6. Runtime (decision-8)

**Budgets.**
- **Hard cap (set by the user, 2026-10-08; scope clarified by Lux, 2026-10-09):** the client framework JS that any one page can ship must stay **≤ 10 kB** min+brotli: every public client export, and a typical import set plus hydration and the island loader. The sum of all client code (12.35 kB today) is reported but not capped, because no page ships the SPA router and island hydration together. Smaller is better, but CPU performance takes priority over shaving bytes.
- **Soft targets (revised 2026-10-09 to today's sizes, to hold the line):** a typical app import set ≤ 6.25 kB, and hydration plus loader ≤ 2.75 kB. They ratchet down whenever a trim lands.
- **Scope of the cap (user, 2026-10-09):** the cap and targets apply to the framework runtime, measured by `pnpm --filter lumiose size`. Sample apps and examples have no size budget: `pnpm --filter lumiose size:apps` reports their framework and app JS so regressions are visible, and stays as small as is reasonable, but it does not fail a build.
- **js-framework-benchmark app bundle:** ≤ 8 kB.

### 6.1 Reactive core

- An alien-signals-style push-pull graph:
  - intrusive `Link` edges;
  - link reuse through a `depsTail` cursor;
  - flags rather than collections, and no recursion.
- Lazy computeds unlink themselves when no longer observed.
- The algorithm is vendored from alien-signals (MIT) with attribution.
- Owners scope cleanup, context, boundaries and async runs.
- Row owners are created lazily, only when a row registers a cleanup or a nested owner.

### 6.2 Scheduling

- Reads are synchronous.
- Writes inside a delegated handler are batched for the duration of that handler. Any other write schedules a microtask flush. `flushSync()` flushes immediately.
- Flush order:
  1. computeds are pulled;
  2. render bindings run, by owner depth, using a depth-bucketed queue only when more than one depth is dirty;
  3. user effects run.
- A disposed effect never runs.

### 6.3 DOM

**Templates.** Minified templates are cloned and walked by paths.

**Bindings.** Bindings use `effect(compute, apply)`. The `apply` functions are hoisted to module level, and a signal can be passed directly as the source with no closure. Statically known values get a single one-time write.

**Events (decision-17).** One listener per event type at `document`. Handlers are found by walking up from the target to the island or app boundary. A `$$xData` slot avoids per-row closures. The compiler hoists `onClick={() => f(row.id)}` into a shared handler plus row data when the closure captures only the row.

**Lists.**
1. Trim the common prefix and suffix.
2. Take the fast path for appends, removals, clears (`textContent`) and swaps.
3. Otherwise use LIS.

**Selectors and branches.** Selectors are O(1). Branches are memoised.

**Async boundaries.** Each async instance gets its own marker range, and the `ErrorBoundary` chain applies.

### 6.4 Server

- String concatenation with fused escaping.
- Context frames, but no instances and no reactive graph.
- Output is a web `ReadableStream`.
- Serialization is data-only: JSON, or seroval in JSON mode.

## 7. Rendering (decisions 4, 9, 19)

### 7.1 Route modes

- Routes export `mode = "static" | "server" | "spa"`, inherited from layouts. The project default comes from `lumiose({ mode, ssr })` in `vite.config.ts` (decision-21); **when unset it is `static`** (server-first). For example, `lumiose({ mode: "spa", ssr: false })` makes the whole project a client-rendered SPA.
- Touching a request API while prerendering is `LUM5001`, and the fix sets `mode = "server"`.
- `export const ssr = false` applies to `spa` routes: the build emits a static shell and renders on the client.

| Mode | HTML | JS | Navigation |
|---|---|---|---|
| `static` | build time (`staticPaths`) | islands | MPA (+ View Transitions) |
| `server` | per request: shell, then streamed boundaries | islands | MPA |
| `spa` | SSR + hydrate, or a client shell (`ssr = false`) | the subtree | client router |

- An SPA subtree is a single root island.
- Its props come from serializable route data. `request`, `cookies` and `locals` are not passed in (`LUM4002`). SPA code calls endpoints instead.

### 7.2 Islands

**Directives:** `client:load`, `client:idle`, `client:visible` (optionally `="200px"`), `client:media="(…)"`, `client:only`.

**Props and children.**
- Props must be serializable; otherwise `LUM4002`.
- `children` and any JSX-valued props are server-rendered once. Slots the island renders appear inline between `<!--l:s:name-->` and `<!--/l:s-->`, and the client adopts those nodes. Slots it does not render during SSR travel as `<template data-l-slot="name">` and are inserted when the island later renders them (contract doc-2 §3.1).
- A `client:*` inside an island's own render is rendered inline, with no separate record.

**Boundaries.** `*.server.*` modules and `src/server/` may not be imported from client code (`LUM4003`). A module-scope signal written during SSR is `LUM4008`, because it would be shared across requests.

### 7.3 SSR response model (decision-19)

1. **Shell.** The response starts after everything outside `<Suspense>` has resolved. Until then, the status, `redirect()`, `notFound()`, `error()`, cookies, headers and `<Head>`/`<Title>`/`<Meta>` can all be set. Failures render `_error`.
2. **Stream.** Boundaries then stream out of order, either through native `<template for>` partial updates or through the `$swap` fallback (about 300 B). Errors render the boundary's `<ErrorBoundary>` in place. A head or status change inside a boundary is `LUM5004`.
3. **SSG and prerender** are always fully resolved, with no fallbacks or swap scripts.

**Request access.** `request()`, `url()`, `params()`, `locals()` and `cookies()` work anywhere during the server render, scoped to the current request.

### 7.4 Hydration

**Pluggable hydration (single compiled walk, contract doc-2).** It uses positional claiming without per-element keys. Comment markers are used only for blocks (`<!--[-->…<!--]-->`), inactive branches (`<!--[!-->`), text separators (`<!--!-->`), and **each async instance's range**. Claiming happens inside each instance's own range, so a shared cursor never interleaves between instances.

**Islands.**
- Each island sits between `<!--l:ID-->` and `<!--/l:ID-->`.
- Each flushed chunk carries a `<script type="application/json" data-l-islands>` with island records: `{ id, ref, props, slots, strategy, awaits: { [instancePath:site:occ]: value } }`.
- An island's records may be **appended across chunks**. A boundary inside an island hydrates only once its chunk has arrived.

**Loader** (about 1 kB, external).
- It reads the records, finds the ranges with a single `TreeWalker` pass, and arms the triggers.
- When a trigger fires, it imports the island module and hydrates it.
- It captures and replays `click`, `input`, `submit` and `keydown`.
- On a mismatch, development reports `LUM4006`. Production client-renders the range instead.

**CSP.** `csp: "strict"` (TASK-138):
- Pages rendered per request get a fresh nonce per response on every inline `<script>`/`<style>` and module preload Lumiose writes (inlined page CSS, `style`-prop rules, the loader, `$swap` scripts, speculation rules, the View Transitions opt-in), `<meta property="csp-nonce">` for the client's preload helper, and `Content-Security-Policy: script-src 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; object-src 'none'; base-uri 'self'` unless the page, middleware or `lumiose({ headers })` sets one. `lumiose dev` writes nonces but sends no policy (Vite injects its own styles).
- Prerendered pages cannot carry a per-visitor nonce: they get the policy as a `<meta http-equiv>` first in `<head>`, with SHA-256 hashes of their inline scripts and styles and `'self'` for external ones.
- `style` props render as `data-l-v` rules of a nonce'd/hashed `<style>`; the client sets styles through the CSSOM. `cspNonce()` gives the app the nonce for its own inline elements.

### 7.5 Navigation and the SPA router

- **MPA by default**, with cross-document View Transitions and speculation-rules prefetch.
- **`lumiose/router`** is active inside `spa` subtrees and built on the Navigation API.
  - `<Link href prefetch="hover|viewport|none">`.
  - `navigate(href, { replace })`.
  - Reactive `params()`, `search()` (with a setter), `url()` and `navigating()`.
  - Nested layouts persist across navigations (a layout's `children` is the outlet).
  - Scroll restoration, focus management and a client-side `_404`.
  - Navigation holds the old page until async content is ready (§4.4).
  - `invalidate()` re-runs the current page's async components (decision-18).

## 8. App layer (decision-18)

### Files

```
src/
  routes/
    _layout.stsx            root layout (persistent); nested _layout.stsx per folder
    index.stsx              /
    blog/[slug].stsx        /blog/:slug        (also: [...rest], (group)/)
    api/posts.ts            endpoint: export GET/POST/… = (ctx) => Response
    sitemap.xml.ts          endpoint; prerendered when static
    _404.stsx  _error.stsx  error pages ({ status, error } props)
  document.stsx             optional: owns <html>/<head>/<body>; default provided
  middleware.ts             export default (ctx, next) => Promise<Response>
  server/                   server-only code (db, auth)
```

### Page exports

- `default`: the component, which may be async.
- `mode` and `ssr`.
- `staticPaths(): Promise<Array<{ params }>>`.
- `action(ctx)`, or `actions = { name(ctx) }`.
- `headers(ctx)`.

### Actions

- Actions receive `ctx.formData()`.
- They return one of:
  - a `Response` or `redirect(to, status?)`;
  - plain data, which the page reads through `actionData()`;
  - `fail(status, data)`.
- Forms post to the page, or to `?/name` for named actions.
- An Origin/CSRF check is on by default.
- Islands enhance forms with `submit(form | data, { action })`, which resolves to a success or failure result and rejects only on unexpected errors, plus `submitting()` and `invalidate()` (decision-20).

### Context

- `ctx` has the shape `{ request, url, params, locals, cookies, env }`.
- Cookies: `cookies.get`, `cookies.set` and `cookies.delete`, plus `signedCookie()`.
- Error helpers: `redirect()`, `notFound()` and `error(status, msg)` throw and are handled by the framework.
- `locals` is typed through `declare module "lumiose" { interface Locals { … } }`.

### Env

- `import.meta.env.PUBLIC_*` is available on the client.
- Secrets are read with `env()` in server-only modules. Importing them into client code is `LUM4003`.

### Document

- Lumiose renders `<html>`, `<head>` and `<body>` by default. `document.stsx` can customise them.
- `<Head>`, `<Title>` and `<Meta>` collect into `<head>` while the shell is rendering.
- There is no `meta` export; `<Title>` and `<Meta>` are the one way to set head content.

### Build (`lumiose build`)

1. Client environment build: islands, the SPA, and all CSS plus the manifests.
2. Server environment build.
3. Prerender of every `static` route and static `GET` endpoint.

Output:
- `dist/client`, holding static assets and prerendered HTML as `path/index.html`. The trailing-slash setting is configurable and `base` follows Vite.
- `dist/client/404.html`.
- `dist/server/entry.js`, which exports `export default { fetch }`.
- Adapters take it from there. `@lumiose/adapter-node` ships first; `static` is used for fully static sites.

### Dev and config

- `lumiose dev` runs Vite with the client and SSR environments.
- Configuration is `vite.config.ts` with `lumiose({ adapter, css, csp, trailingSlash, viewTransitions, prefetch })`.

### Content

Markdown and other content come in through Vite: `import.meta.glob` with `?raw` and any Markdown library. A content-collections helper is post-v1.

## 9. Tooling (decisions 6, 11)

### 9.1 Type checking

**Shadow files.**
- `.lumiose/shadow/<path>.stsx.tsx` contains the masked UTF-16 text.
- Shadow files are written by the dev server, the language server, `lumiose check` and `lumiose typegen`.

**Resolution.**
- With `rootDirs`, `import "./X.stsx"` resolves to the shadow file. Verified on TS 7.0.2: TS tries `X.stsx.ts`, then `X.stsx.tsx`.
- Route shadows are covered by `include`.

**`lumiose check`**
1. Runs typegen.
2. Runs `tsc --noEmit`, mapping shadow paths back to the source files at the same line and column. TypeScript reports columns in UTF-16, which matches the editor.
3. Adds compiler diagnostics and lint results.
4. Supports `--format json`.

### 9.2 Editor

**Takeover mode.** The Lumiose language server sits in front of **one** TS 7 native LSP for `.ts`, `.tsx` and `.stsx`.
- The VS Code extension asks to disable the built-in TS extension for the workspace, as Volar does.
- The proxy rewrites shadow URIs in every request, response and workspace edit, so go-to-definition and rename always land in source files.
- Unsaved `.stsx` buffers are sent to TypeScript as their masked text.

**Style blocks.** `vscode-css-languageservice` runs on the style blocks, with references replaced by same-length identifiers.

**Cross-language features.**
- Class completion in JSX from the in-scope styles.
- Go-to-definition and rename between class names and selectors.
- Hovers on `$` references show the resolved value.
- Compiler diagnostics and execution-contract hovers.

**Extension contents.** The VS Code extension provides the `stsx` language, its grammar (TSX with embedded CSS and `$ref` highlighting), the LSP client and snippets.

**GitHub.** Add `*.stsx linguist-language=TSX` to `.gitattributes`.

### 9.3 Lint, format, test

**`lumiose lint`.**
- Runs oxlint on the shadow TSX.
- Drops diagnostics that fall inside block ranges, such as `no-unused-expressions` on `;ref` statements.
- Optionally runs stylelint on the CSS, with references replaced by identifiers.

**`eslint-plugin-lumiose`.** Provides lint rules and a `.stsx` processor.

**`lumiose fmt`.**
1. Formats the TSX with oxfmt, with each block replaced by a placeholder.
2. Formats each block's CSS separately, protecting the `$` references.
3. Re-indents the blocks and stitches the file back together.

**`prettier-plugin-lumiose`.** Formats `.stsx` files in Prettier.

**Testing.**
- Vitest through the Vite plugin.
- `@lumiose/testing` provides `render()` and Testing Library helpers.
- Vitest browser mode and a few Playwright e2e tests.

## 10. Agent-first DX (decision-10)

1. **Small, familiar surface.**
2. **Docs in the package.**
   - `node_modules/lumiose/docs`.
   - `create-lumiose` writes `AGENTS.md`, plus a `CLAUDE.md` that references it.
   - `lumiose docs <topic>` prints a topic.
   - `llms.txt` is published.
3. **One doc pattern per concept.**
4. **Diagnostics.**
   - Stable codes, generated from the registry.
   - `lumiose explain <code>`.
   - JSON output everywhere.
5. **MCP server (`lumiose mcp`).** Provides `docs_search`, `docs_get`, `check`, `routes`, `components`, `compile`, `render` and `dev_logs`.
6. **Agent eval suite.** Runs on release candidates, and any regression blocks the release.
7. **Skill bundle.**
8. **Deterministic output.**
9. **Codemods** through `lumiose upgrade`.

## 11. Performance model

### Benchmark context

js-framework-benchmark, Chrome 154, keyed, 2026-10-04, M4 (lower is better):

| Framework | CPU (relative) | Memory | Bundle size | First paint |
|---|---|---|---|---|
| vanillajs | 1.05 | 1.87 MB | 2.5 kB | 53.8 ms |
| Marko 6 | 1.10 | 2.19 MB | 4.8 kB | 55.5 ms |
| Vue Vapor | 1.11 | 3.06 MB | 18.7 kB | 86.9 ms |
| Solid 1.9 | 1.13 | 2.68 MB | 4.5 kB | 51.6 ms |
| Svelte 5 | 1.18 | 2.88 MB | 9.7 kB | 71.4 ms |
| React 19.2 | 1.59 | 4.37 MB | 51.4 kB | 226.6 ms |

### Targets

| Metric | Target |
|---|---|
| CPU | ≤ 1.12 |
| Memory | ≤ 2.7 MB (stretch goal: 2.5) |
| Bundle | ≤ 8 kB (runtime hard cap 10 kB) |
| First paint | ≤ 60 ms |

### Techniques by operation

| Operation | Technique |
|---|---|
| Create / append | Template cloning and path walks; one-time writes for static values; hoisted `apply` functions; delegation data slots; lazy row owners; a reactive index only when it is used |
| Replace / clear | Owner disposal and the `textContent` fast path |
| Partial update | Push-pull flags, with equality checks before DOM writes |
| Select row | Compiled `selector()` (2 rows touched) |
| Swap | Trim, swap detection, LIS |
| Memory | Intrusive links, unlinked unobserved computeds, no row closures, signals passed directly as binding sources |
| Startup | Runtime ≤ 10 kB hard cap (aim ≤ 6 kB for typical imports); the hydration code is a separate path and is tree-shaken when it isn't used |

### SSR

- SSR uses sync-first string concatenation with thenable holes.
- Only islands carry hydration markers.
- Pages without islands ship about 0 JS. Awaited data is embedded once.

### Regression gate

- js-framework-benchmark (Lumiose versus Solid, Svelte, Vue Vapor, Marko and React) and the SSR suite run in CI from M1.
- A change fails the gate when it regresses by more than 3% **at 95% confidence over at least 10 runs**.

## 12. Compatibility

| Tool | Status |
|---|---|
| TS 7 / TS 6 | ✅ shadow TSX + stock `tsc`; takeover LSP |
| Vite 8 / Rolldown | ✅ `lumiose/vite` |
| Vitest | ✅ |
| oxlint | ✅ via `lumiose lint` |
| ESLint | ✅ plugin + processor |
| oxfmt / Prettier | ✅ via `lumiose fmt` / plugin |
| stylelint | ✅ optional |
| Tailwind v4, PostCSS, CSS Modules, `.scss` imports | ✅ (no Sass inside `<style>`) |
| Testing Library | ✅ `@lumiose/testing` |
| Web components | ✅ `on:` for custom events |
| GitHub | ⚠️ `.gitattributes` |
| React components | ❌ v1 |
| Storybook / storylite | ⏳ later |

## 13. Risks

| Risk | Mitigation |
|---|---|
| Bespoke `.stsx` tooling (scanner, shadows, takeover LSP) | A single shared scanner; golden tests; the identity-offset invariant; re-evaluate when TS 7.1 lands |
| Agents are unfamiliar with `.stsx` | TSX plus `<style>`; the AGENTS.md hint; diagnostics; evals |
| OXC churn | Exact version pins and fixtures |
| Overhead of a JS-boundary Vite plugin | Rust-side filters; watch for raw AST transfer |
| TS 7.0 has no API | Runtime and best-effort static checks |
| Compiled idioms, the `await` rewrite, re-runs | Narrow patterns; diagnostics; "show compiled output" |
| Crowded positioning | One syntax addition, placement scopes, `$tokens`, islands, evals |
| Marko 6 / Vue Vapor at about 1.10 | Budgets, plus benchmarks in CI from M1 |
| Publishing name | Rename task before release (decision-15) |
| Scope: a full meta-framework plus tooling | Milestones are ordered so that the three sample apps work end-to-end first, with polish after |

## 14. Open items

None block implementation.

**Syntax and DX.** The user decides future syntax and DX questions (decision-16). Candidates:
- the content-collections helper;
- the React island adapter;
- typed theming through `@property`.

## 15. Decision index

| Id | Title | Status |
|---|---|---|
| 1, 2 | Valid TSX + `css` tag; reactive CSS vars | superseded by 11, 12 |
| 3 | Setup-once components + signals, no VDOM | accepted |
| 4 | Server-first, islands, per-route SPA | accepted |
| 5 | Rust compiler on OXC + Lightning CSS, napi + Vite plugin | accepted |
| 6 | TS 7 policy: no TS plugins; `.stsx` language server | accepted |
| 7 | Compiled JSX idioms + reactive props destructuring | accepted |
| 8 | alien-signals-style core; sync reads, batched effects | accepted |
| 9 | Island protocol: `client:*`, markers, data-only serialization | accepted |
| 10 | Agent-first DX contract | accepted |
| 11 | `.stsx` (TSX + raw CSS) and `.tsx` | accepted |
| 12 | Raw CSS, `$name` constants, no reactive CSS | accepted |
| 13 | Async components + Suspense / ErrorBoundary | accepted |
| 14 | Style scope by placement | accepted |
| 15 | Working package name `lumiose` | accepted |
| 16 | Backlog workflow; approval rules | accepted |
| 17 | Events: delegated `onX`, native `on:x` | accepted |
| 18 | Data: async components, endpoints, form actions; no loaders | accepted |
| 19 | SSR: shell first, then stream Suspense boundaries | accepted |

## 16. References

**TASK-1 (Prism): runtimes and benchmarks.**
- js-framework-benchmark, Chrome 154: https://krausest.github.io/js-framework-benchmark/2026/chrome154.html
- alien-signals: https://github.com/stackblitz/alien-signals
- Solid 2 RC: https://github.com/solidjs/solid/discussions/2995
- Vue Vapor: https://github.com/vuejs/core/blob/minor/packages/runtime-vapor/src/apiCreateFor.ts
- Remix 3 hydration: https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md
- Declarative partial updates: https://developer.chrome.com/blog/declarative-partial-updates

**TASK-2 (Photon): toolchain.**
- dom-expressions compiler: https://github.com/ryansolid/dom-expressions/tree/next/packages/compiler
- Vize: https://github.com/ubugeeei/vize
- Rolldown hook filters: https://rolldown.rs/apis/plugin-api/hook-filters
- TS 7.1 plan: https://github.com/microsoft/TypeScript/issues/63703

**Spec review (Prism, v0.2).** TS 7.0.2 experiments in `.local/agents/Prism/spec-review-v02/` confirmed shadow resolution, the automatic-semicolon-insertion and TDZ hazards, and the masking failures inside component elements.
