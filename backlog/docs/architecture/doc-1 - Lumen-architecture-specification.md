---
id: doc-1
title: Lumen architecture specification
type: specification
created_date: '2026-10-08 10:28'
updated_date: '2026-10-08 11:46'
tags:
  - architecture
  - spec
---
# Lumen architecture specification

> **Status:** draft v0.2 for review. Owner: Lux (architect). Milestone: m-0. Tracking task: TASK-3.
>
> **Naming:** the product is called Lumen and the working package name is `lumen` (decision-15). The npm name `lumen` is already taken, so the package will be renamed before it is published.
>
> **Normative language:** the words **must**, **should** and **may** carry their usual specification meaning. Code samples are normative for the shape of the API, not for its internals.
>
> **How to read the labels:**
> - Sections marked **[accepted: decision-N]** follow decisions the user has approved: 3, 4, 11, 12, 13, 14, 15 and 16.
> - Sections marked **[proposal: decision-N]** follow decisions 5–10. These still need user review and may change.
>
> **Superseded decisions:** decision-1 (valid `.tsx` with `css` tagged templates) and decision-2 (reactive CSS interpolation) are superseded by decision-11 and decision-12.

## 0. Summary

Lumen is a TypeScript 7-first web framework.

- **Authoring: `.stsx` files** ("styled TSX"). These are TSX plus raw-CSS `<style>` blocks. Plain `.tsx` is also allowed.
- **Styles are plain CSS.** A style block applies to what encloses it: a component, the whole file, or the whole app with `<style global>`.
  - JS constants are available in CSS as `$name`, inlined at build time.
  - CSS never contains JS expressions.
- **Components run their body once (setup) and hold state in signals.** Any component may be `async`, on both server and client, coordinated by `<Suspense>`.
- **A Rust compiler** turns JSX into cloned templates plus fine-grained DOM bindings for the client, and into string concatenation for the server.
- **Rendering is server-first.**
  - Pages ship zero JS by default.
  - Interactivity comes from islands, chosen where the component is used: `<Counter client:visible />`.
  - Each route can opt into SPA mode.
- **Built on web standards** (`Request`/`Response`, `AbortSignal`, `FormData`), ships as a Vite plugin, and works with the npm, lint, format and test ecosystems.
- **Agent-first.**
  - A small API with one obvious way to do each thing.
  - Docs that ship with each version.
  - Stable diagnostic codes, JSON output from the CLI, and an MCP server.

```tsx
// src/components/Team.stsx — two components, each with private styles, plus shared file styles
import { signal, lifetime, Suspense } from "lumen";
import { api } from "../api.ts";
import { radius, BREAKPOINT } from "../design/tokens.ts";

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
  const member = await api.members.get(id, { signal: lifetime() });
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
  /* file scope: applies to every component in this file */
  button { font: inherit; cursor: pointer; }
</style>
```

```tsx
// src/routes/index.stsx — server component; ships no JS except the island
import { TeamPanel } from "../components/Team.stsx";
import { db } from "../server/db.server.ts";

export default async function Home() {
  const ids = await db.team.featuredIds();

  return (
    <main>
      <h1>Our team</h1>
      <TeamPanel client:visible ids={ids} />

      <style>
        main { max-inline-size: 48rem; margin: 2rem auto; }
      </style>
    </main>
  );
}
```

```tsx
// src/routes/_layout.stsx — app-wide styles
export default function Layout({ children }: { children: JSX.Element }) {
  return <body>{children}</body>;
}

<style global>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; }
</style>
```

## 1. Goals and non-goals

**Goals**

1. **TypeScript 7 first.**
   - Lumen code type-checks with stock TS 7 `tsc`. It uses no TypeScript plugins and needs no TypeScript API.
   - `.stsx` files are covered through shadow TSX files (§9.1).
2. **Styles first-class.**
   - Plain CSS in components, with no CSS-in-JS and no template tags.
   - Scope comes from where a block is placed.
   - Design tokens and breakpoints can be shared between JS and CSS.
   - No CSS runtime.
3. **Performance.**
   - Beat the latest React on js-framework-benchmark on paper, and land in the class of Solid, Svelte 5, Vue Vapor and Marko 6.
   - SSR throughput in the class of the fastest string-based renderers.
4. **Rendering modes.** Client-side rendering, streaming SSR, static generation, islands and SPA, all from one component model.
5. **Ecosystem compatibility.** Vite 8 and Rolldown, Vitest, oxlint and ESLint, oxfmt and Prettier, Tailwind, CSS imports and CSS Modules, any npm package, and web components.
6. **Agent-first.**
   - The obvious code is the correct code.
   - Rules are machine-checkable and diagnostics are machine-readable.
   - Docs are local and match the installed version.

**Non-goals for v1**
- A React compatibility layer.
- A virtual DOM.
- CSS-in-JS, or JS expressions inside CSS.
- Sass inside `<style>` blocks. `.scss` imports still work.
- Resumability.
- RPC-style "server functions" magic.
- Native mobile targets.

### 1.1 Positioning (October 2026)

| | Authoring | Reactivity / rendering | Styles | Server model | Gap Lumen fills |
|---|---|---|---|---|---|
| Solid 2 (RC) | TSX (TSRX frontend coming) | signals, compiled fine-grained | none built in | SolidStart: SSR + full hydration | first-class scoped CSS; server-first islands |
| Svelte 5 | `.svelte` | runes, compiled | scoped `<style>` (file = component) | SvelteKit: SSR + full hydration | TSX; TS 7 without Volar; several components per file, each with its own scope |
| Vue 3.6 Vapor (RC) | `.vue` SFC / JSX | alien-signals, compiled | scoped `<style>`, `v-bind()` | Nuxt: SSR + full hydration | TSX; zero-JS server parts |
| Remix 3 (1.0) | TSX | setup + `handle.update()`, virtual DOM | `css()` mixin | islands (`clientEntry`) + `<Frame>` | fine-grained performance; real CSS |
| Astro 7 | `.astro` + any framework | depends on the framework | scoped `<style>` | islands, server islands | one component model on server and client; TSX |
| Marko 6 | `.marko` | compiled graph, resumable | scoped styles | streaming, resumable | TSX familiarity |
| TSRX / Ripple / Octane | TSX superset (`@if`, `@for`, `<style>`, …) | various | sibling-scoped `<style>` | various | Lumen adds a single construct to TSX (`<style>`), so stock TS 7, linters and agents keep working |

**Lumen's differentiator is the combination of:**
1. TSX plus real CSS with exactly one syntactic addition, so tooling stays cheap.
2. Placement-scoped styles and `$name` constants.
3. Server-first islands plus per-route SPA from one model.
4. An agent-first contract (§10).

## 2. Design principles

1. **TSX plus `<style>`, nothing else.**
   - The only syntax Lumen adds to TSX is the raw-CSS `<style>` element in `.stsx` files.
   - Everything else uses constructs TSX already parses: elements, attributes and namespaced attributes (`client:visible`, `bind:value`).
   - The masking invariant (§4.1) must always hold.
2. **One obvious way.** Each concept gets exactly one blessed API. Alternatives are lint errors, not documented options.
3. **Write it like React, run it like Solid.**
   - Familiar idioms compile to fine-grained code: `.map()`, ternaries, `&&`, destructured props, `onClick` and `async` components.
   - Where an idiom would silently break, the compiler reports an error with a fix.
4. **CSS is CSS, JS is JS.**
   - CSS can read build-time JS constants (`$name`).
   - Runtime values reach CSS only through the standard `style` prop and custom properties.
5. **Explicit boundaries.** Server versus client (`client:*`), component versus file versus global scope (placement and `global`), and tracked versus untracked (`untrack`) are all visible in the code.
6. **Web platform first.** Prefer native features and web standards over framework inventions.
7. **Zero-cost abstractions.** Anything decidable at build time is decided at build time: scoping, constants, templates and event delegation.
8. **Every rule is checkable.** Each documented rule maps to a type error, a compiler diagnostic (`LUMxxxx`) or a lint rule.

## 3. System overview

```
       ┌──────────── authoring: .stsx (TSX + raw-CSS <style>) · .tsx · .ts ────────────┐
       └───────┬──────────────────────────────┬──────────────────────────────┬─────────┘
               │ Vite 8 / Rolldown            │ shadow TSX (masked, same     │ lumen fmt / lumen lint
               ▼                              │ offsets) → stock TS 7 tsc    │ (oxfmt / oxlint on parts)
   lumen/vite (JS plugin, enforce: pre)       │ + LSP proxy over TS 7 LSP    │
     → @lumen/compiler (napi-rs; wasm fallback)
       lumen_compiler (Rust): stsx scan/mask → OXC parse → semantic → analyze → codegen(client|server)
       lumen_css (Rust): Lightning CSS — placement scopes, $name folding, nesting, minify
               │                    │                         │
     client env (islands/SPA)   ssr env                 CSS virtual modules
     lumen/dom runtime          lumen/server runtime    Vite CSS pipeline (HMR, chunking, minify)
               └──────── lumen app layer: file routes, endpoints, actions, adapters ────────┘
 Tooling: `lumen` CLI (dev/build/check/lint/fmt/typegen/docs/explain/mcp) · VS Code extension · @lumen/language-server
```

### 3.1 Repository layout [proposal: decision-5, decision-10]

```
crates/
  lumen_compiler/   pure core (no I/O): stsx scanner + masking, analysis, client/server codegen, diagnostics
  lumen_css/        Lightning CSS: placement scopes, $name substitution, keyframes, class passthrough data
  lumen_napi/       napi-rs v3 bindings (+ wasm32-wasip1-threads fallback)
  lumen_wasm/       wasm-bindgen single-threaded build for the playground
packages/
  lumen/            runtime + app layer + CLI + types — the one package users install
    src/core/       signals, owner tree, context, scheduling, async boundaries (isomorphic)
    src/dom/        client renderer, delegation, lists, hydration
    src/server/     string SSR, streaming, islands
    src/app/        file routes, SPA router, endpoints, actions, adapter API
    src/vite/       Vite plugin (lumen/vite)
    src/cli/        `lumen` binary
    docs/           version-matched docs shipped in the npm package
  language-server/  @lumen/language-server (TS 7 LSP proxy + CSS language service + compiler diagnostics)
  vscode/           VS Code extension (stsx language, grammar, LSP client, snippets)
  eslint-plugin/    eslint-plugin-lumen (rules + .stsx processor)
  prettier-plugin/  prettier-plugin-lumen (.stsx)
  create/           create-lumen
  testing/          @lumen/testing
  adapters/         @lumen/adapter-{node,bun,deno,cloudflare,vercel,netlify,static}
apps/
  docs/             docs site built with Lumen (SSG); emits llms.txt / llms-full.txt
  playground/       in-browser REPL on lumen_wasm
benchmarks/
  js-framework-benchmark/  ·  ssr/  ·  agent-evals/
examples/
```

Users install one package, `lumen`, which exposes the subpaths `lumen`, `lumen/dom`, `lumen/server`, `lumen/router`, `lumen/jsx-runtime` and `lumen/vite`, plus the `lumen` binary. Compiler binaries ship as optional platform dependencies, plus a wasm fallback.

## 4. Authoring model

### 4.1 File types and the masking invariant [accepted: decision-11, decision-14]

| Extension | Contents | Use |
|---|---|---|
| `.stsx` | TSX module + raw-CSS `<style>` blocks | components with styles (the default) |
| `.tsx` | plain TSX; `<style>` is a type error (§4.7) | style-less components, interop |
| `.ts` | TypeScript | logic, tokens, server code, endpoints |

**What a `<style>` element is in `.stsx`**
- Every `<style …>` element in a `.stsx` file is a **raw-text element**, as in HTML. Its content runs up to the first `</style>` and is plain CSS.
- A block may be placed in either of two positions:
  - At the **module top level**.
  - As a **static child inside a component's JSX**, at any depth of the static tree. It may not be inside `{…}` expression containers, conditionals or `.map()` callbacks (`LUM3010`), and it may not be the only thing a component returns (`LUM3011`).

**How the scanner finds blocks**
- The `.stsx` scanner is a pre-pass that understands JS lexing: strings, template literals, comments and regex literals.
- It recognises `<style` only where a JSX element can start: at a top-level statement or in a JSX child position.

**Masking invariant (must hold).** For tools, a `.stsx` file is masked as follows. The resulting **masked TSX** is valid TSX with identical offsets: same characters, same lines, same columns.
- Every `<style>…</style>` block is replaced with spaces. Newlines are preserved.
- `$name` constant references inside CSS (§4.6.4) stay at their exact positions:
  - In a **top-level block**, `$` becomes `;`. So `$radius.lg` becomes the expression statement `;radius.lg`.
  - In a **block inside JSX**, `$` becomes `{` and the character right after the reference becomes `}`. So `$radius.lg;` becomes the expression container `{radius.lg}`. A following character always exists, because the closing tag is masked too.

Every tool integration (type checking, LSP, lint, format) relies on this invariant (§9).

### 4.2 Components [accepted: decision-3; props destructuring is proposal: decision-7]

- A component is a **PascalCase function** returning JSX. It may be a declaration or an arrow function, and may or may not be exported.
- A file may export many components.
- **The body is a setup scope that runs once per instance** (async components: §4.4).
- Props are the single parameter.
  - At call sites, dynamic props are passed as getters, so reading `props.x` is reactive.
  - **Destructuring stays reactive.** The compiler rewrites destructured bindings to `props.x` reads, applying defaults with `undefined` semantics. `...rest` becomes a reactive rest proxy.
- `children` is a lazy prop.
  - Inserting `{children}` mounts it.
  - Inserting it twice triggers `LUM2005`. Use a render-prop function for repeated rendering.
  - Named slots are ordinary props: `<Card header={<h2>Title</h2>}>`.
- `ref={(el) => …}` sets a callback ref, or `const input = ref<HTMLInputElement>()` creates a signal-like ref.
- An early return that depends on reactive values is an error in sync components (`LUM2003`). Conditional UI belongs inside JSX.

### 4.3 Reactivity API (`lumen`) [accepted shape: decision-3; algorithm proposal: decision-8]

| API | Shape | Notes |
|---|---|---|
| `signal(v, opts?)` | read with `s()`; write with `s.set(v)` or `s.update(fn)`; `s.peek()` | `equals` defaults to `Object.is` |
| `computed(fn)` | `c()` | lazy, cached, glitch-free |
| `effect(fn)` | returns a disposer | runs after DOM updates; `fn` may return a cleanup |
| `store(obj)` | deep reactive proxy | mutate directly; tracking is per property |
| `untrack(fn)`, `batch(fn)`, `flushSync()` | | writes inside handlers are batched automatically |
| `onMount(fn)`, `onCleanup(fn)` | owner-scoped | |
| `lifetime()` | `AbortSignal` | aborted on disposal, or on re-run for async components |
| `pending()` | `boolean` | inside an async component, whether a re-run is in flight |
| `createContext(default)`, `provide(ctx, v)`, `inject(ctx)` | setup-scope calls | works across `await` (§4.4) |
| `resource(fetcher)` | `r()`, `loading()`, `error()`, `refetch()` | low-level, for loading on demand. Async components are the default way to load data |
| `<Suspense fallback>`, `<ErrorBoundary fallback={(err, retry) => …}>` | components | §4.4 |
| `<Portal mount>`, `<Dynamic component>` | components | |

**Compiler rules for reactivity**

| Code | Rule |
|---|---|
| `LUM2001` | A setup `const` derived from a signal or prop read is used in JSX or an effect. It is stale; use `computed`. |
| `LUM2002` | A signal is written during render or inside a `computed`. |
| `LUM2003` | An early return in a sync component depends on reactive values. |
| `LUM2004` | A component is called as a function. |

### 4.4 Async components [accepted: decision-13]

Any component may be an `async function`, on both server and client:

```tsx
export async function MemberCard({ id }: { id: string }) {
  const member = await api.members.get(id, { signal: lifetime() });
  return <article>{member.name}</article>;
}

<Suspense fallback={<Spinner />}>
  <MemberCard id={selected()} />
</Suspense>
```

- **Context across `await`.** The compiler rewrites every `await` inside a component, so the owner and tracking context is restored when execution resumes. This is the Svelte 5 technique; browsers do not yet have AsyncContext. As a result, `inject`, `onCleanup` and tracking all keep working after an `await`.
- **Re-running.** Props and signals read in the body, including after an `await`, are tracked. When one of them changes, the component re-runs:
  - The previous run is aborted through `lifetime()`.
  - **The old UI stays visible** until the new run resolves.
  - `pending()` reports that a re-run is in flight.
- **Bindings stay fine-grained.** JSX bindings update in place and never re-run the body. Reading a component's *own* signals in the body, outside JSX, triggers `LUM2007`, because every change would re-run the whole component.
- **Fallbacks and errors.**
  - `<Suspense fallback>` shows its fallback while descendants are pending, on first load only.
  - `<ErrorBoundary fallback={(error, retry) => …}>` catches rejections.
  - When there is no boundary:
    - the server waits for the component (in-order streaming);
    - the client renders nothing until it resolves;
    - errors go to the route's `_error` page.
- **On the server,** each `<Suspense>` is an out-of-order streaming point (§7.3).
- **Hydration.**
  - Awaited results inside islands are serialized as plain data into the island records, so hydration never fetches again (§7.4).
  - A non-serializable awaited value triggers `LUM4007`.
  - Everything awaited inside an island reaches the client. The docs must state this.
- **Types.** `JSX.ElementType` allows components that return `Promise<JSX.Element>`. This was verified on TS 7.0.2.

### 4.5 JSX semantics [proposal: decision-7]

**Bindings**
- Literals and plain identifiers are static.
- Expressions containing calls or member access become **fine-grained bindings**, implemented as `effect(compute, apply)` on exactly one node or attribute.
- `untrack()` opts out.

**Compiled idioms** (there is deliberately no `<For>` or `<Show>`)

| You write | Compiles to |
|---|---|
| `{items().map((it, i) => <Row key={it.id} />)}` | keyed reconciliation. `key` is optional; without it, items are keyed by reference. `i` becomes a reactive index |
| `` `item.key === sig()` `` inside a `.map` | O(1) `selector()`: only two rows update on selection |
| `{c() ? <A/> : <B/>}`, `{c() && <A/>}` | memoised branch; recreated only when the condition's truthiness changes |
| `{fn()}` returning nodes, arrays or strings | dynamic insert (unkeyed fallback) |

**Elements and attributes**

| Feature | Rule |
|---|---|
| `class` | Accepts a string, an array of strings or falsy values, or a `Record<string, boolean>`. Values can be combined. `className` is a type error |
| `style` | A string, or an object with kebab-case keys including custom properties (`{ "--accent": color() }`). Each key updates on its own. This is the only bridge from runtime values to CSS: `var(--accent)` |
| events | `onClick={fn}` is delegated (rooted at the island or app root). `on:scroll={fn}` attaches a native listener. Events are typed native events |
| `bind:value`, `bind:checked` | Two-way binding to a writable signal |
| `attach={[tooltip("Hi")]}` | Attachments of the form `(el) => cleanup?` |
| `innerHTML` | Allowed. The `no-unsafe-html` lint rule warns |
| `client:*` | Island directives on component elements (§7.2) |
| `for`, `tabindex`, `aria-*`, `data-*` | Standard HTML attribute names |

### 4.6 Styles [accepted: decision-12, decision-14]

#### 4.6.1 Placement decides scope

| Placement | Applies to |
|---|---|
| Inside a component's JSX | That component's own templates only, including JSX in closures inside it such as `.map` callbacks. It does not reach other components it renders |
| Top level of the `.stsx` file | Every template in the file |
| `<style global>` (either placement) | The whole app, unscoped |

```tsx
export function Tabs() {
  return (
    <div class="tabs">…
      <style> .tabs { display: flex; } </style>      {/* Tabs only */}
    </div>
  );
}

export function Tab() {
  return (
    <button class="tab">…
      <style> .tab { padding: 0.5rem; } </style>     {/* Tab only */}
    </button>
  );
}

<style> button { font: inherit; } </style>          /* Tabs and Tab */
```

#### 4.6.2 Scoping mechanics

- **Scope tokens.** Each scope has a token: `data-l-<hash>`, a stable base36 hash of the root-relative path plus the component name for component scopes.
  - Tokens are baked into the static template HTML of the elements they cover, so scoping costs nothing at runtime.
  - Only scopes that actually have styles emit tokens.
- **Selector rewrite.** The last compound selector gets `[data-l-<hash>]`, placed before any pseudo-element. This gives a (0,1,0) specificity bump, so scoped rules reliably beat global element rules regardless of the load order of code-split CSS.
- **Escape hatches.**
  - `:global(sel)` leaves `sel` unscoped.
  - `:deep(sel)` scopes only its left side, which lets you style child-component internals.
- **Scoped names.** `@keyframes` names are scoped, and `animation` / `animation-name` references are rewritten. Custom properties are never scoped.
- **Order within a file.** File-level CSS is emitted first, then component blocks in source order, so component rules win ties.
- **Children** passed from another file or component keep their author's tokens, so slot content is styled by whoever wrote it.
- **Class passthrough.** When a parent passes `class` to a component, the parent's tokens at that call site also land on the child's root element(s), as in Vue. This makes `.cta {}` in the parent work for `<Button class="cta" />`.

#### 4.6.3 Global

`<style global>` emits its block unscoped. Use it for resets, tokens, fonts and app-wide rules, usually in `_layout.stsx`.

#### 4.6.4 `$name`: build-time constants in CSS

```ts
// src/design/tokens.ts
export const BREAKPOINT = "48rem";
export const radius = { sm: "0.25rem", lg: "0.75rem" } as const;
```

```css
.card { border-radius: $radius.lg; }
@media (width < $BREAKPOINT) { .card { border-radius: $radius.sm; } }
```

**Where `$` works**
- `$name` (with dot notation) may appear in **property values** and **at-rule preludes** (`@media`, `@container`, `@supports`).
- It may not appear in selectors (where `[attr$=…]` keeps its CSS meaning) or in property names.
- It is never substituted inside CSS strings, comments or `url()`.

**What can be referenced**
- Top-level `const` bindings in the file.
- `const` bindings inside the enclosing component, for component-level blocks.
- `export const` values imported from `.ts`, `.tsx` or `.stsx` modules.
- In every case the value must be **statically evaluable**: literals, template literals of constants, members of `as const` objects or arrays, and simple arithmetic or concatenation.
- Anything else is `LUM3008`. Signals and props are always an error, and the fix suggests the `style` prop bridge.

**How values are inserted**
- Strings are inserted verbatim as CSS text, and numbers as-is. For units, use `calc($gap * 1px)` or store `"8px"`.
- `$brand-primary` is `LUM3009`, because JS identifiers can't contain `-`. The suggestion is `$brand.primary` or `$brandPrimary`.

**Tooling behaviour**
- Thanks to masking (§4.1), TypeScript sees every reference: hover, go-to-definition, rename and unused-import checks all work.
- Editing `tokens.ts` re-compiles only the dependent CSS during HMR.

#### 4.6.5 Runtime values

CSS contains no JS expressions. For the rare per-instance dynamic value, set a custom property with the `style` prop (`style={{ "--progress": pct() }}`) and read it in CSS (`width: calc(var(--progress) * 1%)`). The update is fine-grained (`setProperty`).

#### 4.6.6 Pipeline and interop

- **Extraction.** Extracted CSS becomes Vite virtual modules (`File.stsx?lumen&type=style&lang.css`). The Vite pipeline then handles:
  - CSS-only HMR,
  - PostCSS and Tailwind,
  - chunk extraction,
  - Lightning CSS minification and targets.
- **SSR links.** SSR emits `<link>` tags for the CSS of every module it renders, including server-only ones.
- **Interop.** `import "./x.css"`, CSS Modules, `.scss` imports and Tailwind v4 work unchanged.
- **Diagnostics.**
  - `LUM3005`: unused scoped selector.
  - Unknown static class name: opt-in.
  - `LUM3012`: a custom property is set via `style` but never read in the file's CSS.
- **Later (v1.x).**
  - Typed component theming via `@property` declarations.
  - Opt-in native `@scope` output.

### 4.7 Types (`jsxImportSource: "lumen"`)

- `tsconfig.json` sets `"jsx": "preserve", "jsxImportSource": "lumen"`, and `rootDirs` includes `.lumen/shadow` (§9.1).
- **`IntrinsicElements`** derive from the DOM tag maps with Lumen props:
  - typed `on*` and `on:*` events,
  - `class` and `style` types,
  - `bind:*`.
  - `style` is **omitted**. In `.stsx` files, `<style>` blocks are masked away before TypeScript sees them; in `.tsx` files, writing `<style>` is a type error pointing at `.stsx`. SVG `<style>` is handled by the compiler.
- **`IntrinsicAttributes`** add `key?` and the `client:*` directives.
- **`JSX.ElementType`** accepts sync and async function components.
- `className`, camelCase `style` keys and `htmlFor` are absent, so TypeScript reports them, and the docs map each error to its fix.

## 5. Compiler (Rust) [proposal: decision-5]

### 5.1 Pipeline

```
file.stsx ─▶ stsx scanner: locate <style> blocks (placement, attrs, raw CSS, $refs) + masked TSX
          ─▶ oxc_parser(masked TSX) ─▶ oxc_semantic
          ─▶ analyze: components, scopes per <style> placement, props destructuring, compiled idioms,
                      setup-scope reads, await sites, island sites, $ref resolution (incl. imported consts)
          ─▶ lumen_css: substitute $refs → Lightning CSS parse → scope visitor (tokens, :global/:deep,
                      keyframes) → targets/nesting → CSS + source map
          ─▶ codegen(client | server) via VisitMut + AstBuilder (original spans kept)
          ─▶ oxc_codegen + oxc_sourcemap ─▶ { code, map, css, diagnostics, meta }
```

`.tsx` files skip the scanner. Everything else is identical.

**Implementation rules** (from TASK-2):
- Pin every `oxc_*` crate and `lightningcss` exactly, and upgrade behind golden fixtures.
- Use `VisitMut` + `AstBuilder` + `oxc_semantic`, and avoid `oxc_traverse`.
- Keep a pure core crate with no I/O.
- Resolving imported constants needs the imported module's source. The core asks the host (napi or wasm) for it, and reports those modules as dependencies so HMR can invalidate.
- `@dom-expressions/compiler` (Solid's OXC compiler, MIT) is the reference design. Reuse code and fixtures selectively with attribution; don't fork it.
- Each expression gets an **execution-contract trace**: tracked, untracked, once, or deferred. It is exposed through LSP hovers and `lumen explain`.

### 5.2 Client output (illustrative)

```js
// compiled from MemberCard above (client target)
import { signal, lifetime } from "lumen";
import { template, insert, delegateEvents, $await } from "lumen/dom";
import "/src/components/Team.stsx?lumen&type=style&lang.css";

const _t0 = /*#__PURE__*/ template(`<article class=card data-l-k3x9a2 data-l-f81c0q><h3> </h3><button data-l-f81c0q>👏 <!></button>`);

export async function MemberCard(props) {
  const member = await $await(0, () => api.members.get(props.id, { signal: lifetime() })); // context restore + hydration replay
  const kudos = signal(member.kudos);
  const _el = _t0();                                   // cloneNode, or claim during hydration
  const _h3 = _el.firstChild, _btn = _h3.nextSibling;
  _h3.firstChild.data = member.name;                   // static after await: one-time write
  _btn.$$click = () => kudos.update((n) => n + 1);
  insert(_btn, () => kudos(), _btn.lastChild);
  return _el;
}
delegateEvents(["click"]);
```

```css
/* Team.stsx?lumen&type=style&lang.css — file scope first, then component scopes */
button[data-l-f81c0q] { font: inherit; cursor: pointer; }
.panel[data-l-p02mz7] { display: grid; gap: 1rem; }
@media (width < 48rem) { nav[data-l-p02mz7] { flex-direction: column; } }
.card[data-l-k3x9a2] { padding: 1rem; border-radius: 0.75rem; }
```

### 5.3 Server output (illustrative)

```js
import { ssr, escape, $await } from "lumen/server";
export async function MemberCard(props) {
  const member = await $await(0, () => api.members.get(props.id));   // value recorded for island hydration
  const kudos = signal(member.kudos);
  return ssr(["<article class=card data-l-k3x9a2 data-l-f81c0q><h3>", "</h3><button data-l-f81c0q>👏 <!--[-->", "<!--]--></button></article>"],
    escape(member.name), escape(kudos()));
}
```

- On the server, signals are plain cells and `computed` runs once.
- Templates are static string arrays.
- Hydration markers are emitted only inside island subtrees (§7.4).

### 5.4 Islands, `await` rewrite and diagnostics

- **Islands.** `<X client:visible …/>` compiles to `island(ref, X, props, strategy)` on the server. `ref` is X's module specifier plus its export name. Using a local, non-exported component as an island is an error (`LUM4001`). On the client, `client:*` is type-only.
- **`await` rewrite.**
  - Inside components, every `await e` becomes `await $await(n, () => e)`.
  - This restores the owner and tracking context.
  - On the server, it records the resolved value for islands.
  - During hydration, it replays the recorded value instead of calling `e` again.
- **Diagnostics** have the shape `{ code, severity, message, span, labels, help, fix?, docs }`.
  - Code ranges: 1xxx syntax / file format, 2xxx reactivity, 3xxx styles, 4xxx islands and boundaries, 5xxx routing, 9xxx internal.
  - Codes are stable forever.
  - Output: human code frames, or `--format json`.
  - Diagnostics surface everywhere: the Vite overlay, `lumen check`, the LSP and MCP.

### 5.5 Distribution and the Vite plugin

- **Packages.**
  - napi-rs v3 platform packages (`@lumen/compiler-<platform>`) plus a `wasm32-wasip1-threads` fallback.
  - A single-threaded wasm-bindgen build for the playground.
- **`lumen/vite`.**
  - Runs as `enforce: "pre"` with a Rust-side hook filter for `.stsx` and `.tsx`.
  - Chooses the generator per Vite environment.
  - Serves CSS virtual modules and builds the island manifest.
  - Handles HMR by remounting component instances.
  - Returns JS (`moduleType: "js"`) for `.stsx`, and TSX with types intact for `.tsx`.
- **Accepted cost.** Running as a JS plugin (string in, string out) is somewhat slower than an in-core transform. Watch Rolldown's work on raw AST transfer.

## 6. Runtime [proposal: decision-8]

**Budget:** core + DOM + lists + hydration + async boundaries ≤ **5.5 kB** min+brotli.

### 6.1 Reactive core

- An alien-signals-style push-pull graph:
  - nodes `{deps, depsTail, subs, subsTail, flags}`;
  - intrusive doubly-linked `Link` edges;
  - link reuse via a `depsTail` cursor;
  - no `Set` or `Map`, no recursion.
- Computeds are lazy, and they unlink when no longer observed.
- The algorithm is vendored (MIT, with attribution). Naming follows TC39 Signals, but nothing depends on that proposal.
- An owner tree scopes cleanup, context, boundaries and async runs.

### 6.2 Scheduling

- Reads are synchronous.
- Effects are batched:
  - each delegated handler runs as a batch;
  - stray writes trigger a microtask flush;
  - `flushSync()` flushes immediately.
- Flush order: computeds, then render bindings in tree order, then user effects.

### 6.3 DOM renderer

- **Templates.** Minified `<template>` HTML is cloned, with optional closing tags omitted. Nodes are reached through precomputed `firstChild`/`nextSibling` paths, ivi-style, and comment anchors are added only where needed.
- **Bindings.**
  - Bindings are `effect(compute, apply)` with an equality check.
  - Values proven static get one-time writes.
  - The compiler may merge cheap bindings into one effect, as a tuning knob.
- **Events.**
  - Delegation is rooted at the island or app root, so a `stopPropagation` outside it is not a problem.
  - Each node gets a `$$click` handler and a `$$clickData` slot, which avoids a closure per row.
  - `on:x` is a native listener.
- **Lists.**
  1. Trim the common prefix and suffix.
  2. Take fast paths: append, remove, clear via `textContent`, swap.
  3. Otherwise use LIS for minimal moves.

  Each row owns its own subtree.
- **Selectors and branches.**
  - The selector pattern gives O(1) select.
  - Branches memoise truthiness.
- **Async boundaries.** A boundary tracks pending descendants, shows its fallback on first load only, keeps stale UI on re-runs, and hands rejections to the nearest `ErrorBoundary`.

### 6.4 Server runtime

- Server components are functions that concatenate strings, with escaping fused into the output.
- There are no instance objects and no reactive graph.
- Output is a web `ReadableStream`, flushed at `<Suspense>` boundaries and at island ends.
- Serialization is data-only: JSON, or seroval in JSON mode. Nothing is ever evaluated, which is the lesson of CVE-2025-55182.

## 7. Rendering modes [accepted: decision-4; protocol details proposal: decision-9]

### 7.1 Route modes

Each route sets `export const mode = "static" | "server" | "spa"`. The mode is inherited from layouts. The default is `static` unless the route needs request-time data. `lumen routes` shows the resolved modes.

| Mode | HTML | JS shipped | Navigation |
|---|---|---|---|
| `static` (SSG) | at build time (`staticPaths()` for params) | islands only | MPA + cross-document View Transitions |
| `server` (SSR) | per request, streamed | islands only | MPA |
| `spa` | `ssr: true`: SSR + whole-tree hydration; `ssr: false`: client shell | whole SPA subtree | client router inside the subtree |

An SPA subtree is a single root island, so there is one hydration mechanism for everything.

### 7.2 Islands

| Directive | Hydrates when |
|---|---|
| `client:load` | as soon as possible (`modulepreload` hint) |
| `client:idle` | the browser is idle (`requestIdleCallback`, with a timeout) |
| `client:visible` | the island scrolls into view (`IntersectionObserver`; optional root margin `client:visible="200px"`) |
| `client:media="(…)"` | the media query matches |
| `client:only` | client-rendered, with no SSR |

- **Props.**
  - Island props must be serializable: JSON plus `Date`, `Map`, `Set`, `BigInt`, `URL`, `RegExp`, typed arrays and cycles.
  - Anything else is `LUM4002`, reported at dev time and by `lumen check`.
- **Children.** An island's children are server-rendered static HTML, inserted where `{children}` appears. They are reactive only if they are themselves islands.
- **Server-only code.** `*.server.*` modules and `src/server/` are forbidden in client graphs (`LUM4003`). Browser APIs used at module scope in server-rendered code produce a warning (`LUM4004`).
- **No wrapper element.** Islands are delimited by comment markers, so CSS child combinators and structural pseudo-classes are unaffected.

### 7.3 Streaming SSR

- `renderToStream(app, { request })` returns a web `ReadableStream`.
- Without boundaries, streaming is in-order: everything before the first unresolved `await` flushes immediately.
- **Out-of-order streaming** happens at `<Suspense>` boundaries:
  - The fallback is sent first.
  - Resolved content is then delivered via native declarative partial updates (`<template for>` + `<?marker>`, in Chrome 150+) where the browser supports them, or else via a `<template data-l-s>` chunk plus a shared swap function (~300 B).
  - Islands inside a chunk boot after the swap.
- `<Head>`, `<Title>` and `<Meta>` collect into `<head>`. CSS links and `modulepreload` hints flush in the first chunk.
- `<ErrorBoundary>` works on both server and client.

### 7.4 Hydration protocol

- **Positional claiming.** The same compiled walk creates or claims nodes. There are no per-element keys.
- **Markers.** Comment markers appear only where structure is ambiguous:
  - `<!--[-->…<!--]-->` around blocks,
  - `<!--[!-->` for an inactive branch,
  - `<!--!-->` between adjacent text nodes.
- **Island records.**
  - Each island sits between `<!--l:ID-->` and `<!--/l:ID-->`.
  - Each flushed chunk carries one `<script type="application/json" data-l-islands>` with `{ id, ref, props, awaits, strategy }`.
  - `awaits` holds the values recorded by `$await` (§5.4).
- **Loader** (~1 kB, an external module script).
  - It reads the records and finds island ranges in a single `TreeWalker` pass.
  - It arms each island's triggers, then `import(ref)` and `hydrate()`.
  - It captures `click`, `input`, `submit` and `keydown` events before hydration and replays them afterwards.
- **Mismatches.** A mismatch is `LUM4006` in development. In production, the island falls back to client-rendering its range.
- **CSP.**
  - In the default mode, inline `style` attributes (from `style` props) are emitted.
  - In `csp: "strict"` mode, they become per-instance rules inside a nonce'd `<style>`, and the loader and swap scripts carry the nonce.
  - Client-side `setProperty` is always CSP-safe.

### 7.5 Navigation

- **MPA by default.** Cross-document View Transitions (opt-in) and speculation rules for prefetching give a fast MPA with zero JS.
- **SPA router (`lumen/router`).**
  - Active only inside `spa` subtrees.
  - Built on the Navigation API.
  - Supports nested layouts and `<Link>` prefetching.
- **Server fragments (later).** Remix 3-style `<Frame src>` fragments that can be reloaded from islands, with island state preserved.

## 8. App layer

- **File routes** live under `src/routes/`.
  - Page files: `index.stsx`, `blog/[slug].stsx`, `docs/[...path].stsx`.
  - Route groups: `(group)/`.
  - Special files: `_layout.stsx`, `_404.stsx`, `_error.stsx`.
  - Pages may also be `.tsx`.
  - Endpoints are `*.ts` files exporting `GET`, `POST`, and so on.
- **Page exports.**
  - `default`: the component, which may be async.
  - `mode`, `staticPaths`, `headers`, `meta`.
  - `action`: a POST form handler. Forms work without JS; islands can enhance them with `submit()`.
- **Context and middleware.**
  - Pages and endpoints receive `{ request, url, params, locals, cookies }`.
  - Middleware lives in `src/middleware.ts`.
- **Typegen.** It runs automatically and emits `.lumen/types` with typed params, `RouteProps<"/blog/[slug]">` and a typed `href()`.
- **Server and dev.**
  - The build produces `export default { fetch }`.
  - Adapters wrap it for node, bun, deno, cloudflare, vercel, netlify and static hosting.
  - Development uses the Vite 8 Environment API.
- **Config.** Everything goes in `vite.config.ts`, as `plugins: [lumen({ adapter, css: { targets }, csp, viewTransitions, prefetch })]`.
- **Not in v1:** RPC server functions, a separate loader layer, image optimisation, i18n routing.

## 9. Tooling [accepted: decision-11; TS policy proposal: decision-6]

### 9.1 Type checking `.stsx` with stock TS 7

- **Shadow files.** `lumen` writes masked shadow files to `.lumen/shadow/<path>.stsx.tsx`.
  - Each shadow file is identical to its source at every offset (§4.1).
  - The writers are the dev server, the language server, `lumen check` and `lumen typegen --watch`.
- **Resolution.**
  - `tsconfig` sets `rootDirs: ["src", ".lumen/shadow/src"]`.
  - Imports of `./X.stsx` then resolve to the shadow `X.stsx.tsx`.
- **`lumen check`** runs stock `tsc --noEmit`, rewrites shadow paths back to `.stsx` (same line and column), adds compiler and lint diagnostics, and supports `--format json`.
- **No TypeScript API is needed.** When the TS 7.1 API ships (planned for November 2026), evaluate in-memory virtual files as an optimisation.

### 9.2 Editor

- **VS Code extension.**
  - Registers the `stsx` language.
  - Grammar: TSX with embedded CSS in `<style>` blocks; `$refs` are highlighted.
  - Includes snippets and the commands "Show compiled output" and "Explain diagnostic".
- **`@lumen/language-server`.**
  - For the TSX parts, it **proxies TypeScript 7's own native LSP**: it sends masked text for open `.stsx` documents and maps URIs. Positions map one to one because offsets are identical.
  - For `<style>` blocks, it runs `vscode-css-languageservice` with the TSX parts masked out.
  - Cross-language features:
    - completion of class names in JSX from the in-scope style blocks;
    - go-to-definition and rename between JSX classes and CSS selectors;
    - `$ref` hovers that show the folded value;
    - unused and unknown class diagnostics;
    - compiler diagnostics and execution-contract hovers.
  - It works in any LSP editor (Neovim, Zed, Helix).
- **GitHub.** Until Linguist supports `.stsx`, use `.gitattributes`: `*.stsx linguist-language=TSX`.

### 9.3 Lint, format, test

| Concern | Approach |
|---|---|
| Lint | `lumen lint` runs oxlint on the shadow TSX and maps results back (same offsets); stylelint runs on CSS parts, optionally. `eslint-plugin-lumen` provides rules plus a `.stsx` processor for ESLint |
| Format | `lumen fmt` formats the TSX with oxfmt, with each style block replaced by a placeholder. It formats each block's CSS with oxfmt's CSS formatter (or Prettier), keeping block indentation, then stitches the result back together. `prettier-plugin-lumen` serves Prettier users |
| Test | Vitest via the Vite plugin. `@lumen/testing` provides `render()` and Testing Library queries. Vitest browser mode covers the real DOM. A few Playwright e2e tests |
| Devtools | Later: a signal graph, island and owner-tree panel built on compiler `meta` |

## 10. Agent-first DX [proposal: decision-10]

1. **Small, familiar surface.**
   - About 25 core exports.
   - JSX that looks like React, CSS that is CSS, and `$tokens` that look like Sass.
   - Names borrowed from the best-known APIs.
2. **Docs inside the package.**
   - `node_modules/lumen/docs/**/*.md` matches the installed version.
   - `create-lumen` writes `AGENTS.md` and a `CLAUDE.md` that references it. These state that `.stsx` is TSX plus raw-CSS `<style>` blocks, and point agents at the local docs.
   - `lumen docs <topic>` prints a topic.
   - `llms.txt` and `llms-full.txt` are published on the site.
3. **One doc pattern per concept:** concept, then API, minimal example, common mistakes (generated from the diagnostics), and related diagnostics.
4. **Machine-legible diagnostics.** Every diagnostic has a stable `LUMxxxx` code, help text and fixes. `lumen explain <code>` gives details, and `--format json` works everywhere.
5. **MCP (`lumen mcp`).** Tools: `docs_search`, `docs_get`, `check`, `routes`, `components` (props, islands, style scopes), `compile`, `render`, `dev_logs`.
6. **Agent eval suite.**
   - Real coding agents run a fixed set of tasks, including writing `.stsx` with scoped styles and `$tokens`.
   - Metrics: first-attempt `lumen check` pass rate, success rate and tokens used.
   - A regression blocks the release.
7. **Skills.** A skill bundle and an AGENTS.md snippet, installed by `lumen agents init`.
8. **Deterministic output.** Stable hashes and codegen.
9. **Upgrades.** `lumen upgrade` runs codemods.

## 11. Performance model

### 11.1 The bar

Figures are from js-framework-benchmark, Chrome 154, keyed implementations, published 2026-10-04 on an M4. Lower is better.

| Framework | CPU | Run memory | Size | First paint |
|---|---|---|---|---|
| vanillajs | 1.05 | 1.87 MB | 2.5 kB | 53.8 ms |
| alien-signals (manual DOM) | 1.06 | 2.09 MB | 2.9 kB | 52.6 ms |
| Marko 6 | 1.10 | 2.19 MB | 4.8 kB | 55.5 ms |
| Vue Vapor 3.6-rc | 1.11 | 3.06 MB | 18.7 kB | 86.9 ms |
| Ripple | 1.11 | 2.42 MB | 9.6 kB | 67.2 ms |
| Solid 1.9 | 1.13 | 2.68 MB | 4.5 kB | 51.6 ms |
| Svelte 5.42 | 1.18 | 2.88 MB | 9.7 kB | 71.4 ms |
| React 19.2 hooks | 1.59 | 4.37 MB | 51.4 kB | 226.6 ms |
| React Compiler 19.0 | 1.65 | 4.58 MB | 50.0 kB | 219.8 ms |

**Lumen targets:** CPU ≤ 1.12, run memory ≤ 2.6 MB, benchmark bundle ≤ 5.5 kB compressed, first paint ≤ 60 ms. The real competitors are Marko 6, Vue Vapor, Solid and ivi, not React.

### 11.2 Why the design reaches it

| Operation | Lumen technique |
|---|---|
| create / append rows | template cloning, path walks, one-time writes for static parts, delegation data slots instead of row closures, zero-allocation links |
| replace / clear | owner disposal, `textContent` fast path |
| partial update | push-pull flags; only affected bindings run, with an equality check |
| select row | compiled `selector()` updates only 2 rows |
| swap rows | prefix/suffix trimming, swap detection, LIS (React: 89.7 ms, 8.2× vanilla) |
| memory | intrusive links; unobserved computeds unlinked; no per-row handler closures |
| startup | ≤ 5.5 kB runtime; no virtual DOM, reconciler or synthetic event system; styles extracted statically (no CSS runtime) |

### 11.3 SSR and islands

- **SSR.** String concatenation with escaping fused into the output, no instances or graph on the server, and markers only inside islands. This is the technique behind Marko's and Solid's SSR leads.
- **Pages.** With no islands, a page ships ≈ 0 JS. With islands, it ships the ~1 kB loader, the runtime (≤ 5.5 kB) and the islands' own code. Awaited data is embedded once, never fetched twice.
- **Measured in CI from M1.**
  - The js-framework-benchmark keyed implementation is compared against Solid, Svelte, Vue Vapor, Marko and React.
  - A reproducible SSR suite runs alongside it.
  - A regression of more than 3% blocks the release.

## 12. Compatibility matrix

| Tool | Status |
|---|---|
| TypeScript 7 | ✅ stock `tsc` + native LS via shadow TSX; no plugins or API |
| TypeScript 6 | ✅ same mechanism |
| Vite 8 / Rolldown | ✅ `lumen/vite` |
| Vitest | ✅ via the Vite plugin |
| oxlint | ✅ through `lumen lint` (shadow TSX); bare oxlint does not read `.stsx` |
| ESLint | ✅ `eslint-plugin-lumen` processor |
| oxfmt / Prettier | ✅ through `lumen fmt` / `prettier-plugin-lumen` |
| stylelint | ✅ on extracted CSS parts (optional) |
| Tailwind v4, PostCSS, CSS Modules, `.scss` imports | ✅ via the Vite CSS pipeline. No Sass inside `<style>` |
| Testing Library | ✅ `@lumen/testing` |
| Web components | ✅ rendered as elements; custom events via `on:` |
| npm packages | ✅ any ESM; browser-only libraries go in `client:only` islands |
| GitHub highlighting | ⚠️ `.gitattributes` mapping until Linguist supports `.stsx` |
| React / Vue / Svelte components | ❌ v1 (a React island adapter is a candidate) |
| Storybook / storylite | ⏳ later |

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `.stsx` tooling (scanner, shadow files, LSP proxy) is bespoke | Editor bugs, stale types | The masking invariant keeps offsets identical, so there is no source-map layer. Golden tests for the scanner. Shadow files are regenerated by every tool. Re-evaluate on TS 7.1 |
| Agents don't know `.stsx` yet | First-attempt errors | It is TSX plus `<style>` (Svelte/Vue-like), plus the AGENTS.md hint, `lumen check` diagnostics and agent evals |
| Bare oxlint/oxfmt and GitHub don't read `.stsx` | Friction | `lumen lint` / `lumen fmt` wrappers, ESLint and Prettier plugins, `.gitattributes`. Upstream Linguist support later |
| The scanner mistakes `<style` in exotic code (e.g. a lowercase `style` type in generics) | Parse errors | Lexer-aware scanner; documented limitation; diagnostic `LUM1003` |
| OXC is pre-1.0 and its API churns | Upgrade cost | Exact pins, fixtures, a pure core |
| No in-core Rolldown plugin | Transform overhead | Rust-side filters; track raw AST transfer |
| TS 7.0 has no API | No type-aware checks (serializability) | Runtime dev checks plus best-effort static checks; revisit after 7.1 |
| Compiled idioms and the `await` rewrite differ from plain JS | Surprises | Narrow documented patterns, diagnostics, "show compiled output" |
| Async re-run semantics (tracked body reads) | Unexpected re-runs | `LUM2007`, a dedicated docs page, `pending()` |
| Crowded positioning (TSRX, Ripple, Octane) | Weak differentiation | Lead with one syntax addition, placement-scoped CSS, `$tokens`, islands, agent evals |
| Marko 6 and Vue Vapor already at about 1.10 CPU | "Faster" claim at risk | Benchmarks in CI from M1; ≤ 5.5 kB budget |
| Package name `lumen` taken on npm | Cannot publish as-is | Pre-publish rename task (decision-15) |

## 14. Open questions for the user

1. **Review proposals 5–10:**
   - 5: Rust compiler on OXC + Lightning CSS.
   - 6: TS 7 policy.
   - 7: compiled JSX idioms and reactive props destructuring.
   - 8: alien-signals core.
   - 9: island protocol.
   - 10: agent-DX contract.
2. **Data layer.** The proposal is async components (server and client), endpoints and form actions, with no separate route `loader`. Should there also be a Remix-style `loader`?
3. **Signal read syntax.** `count()` (proposed, as in Solid and Angular), or `count.value` (as in Vue and Preact)?
4. **Events.** `onClick` delegated plus `on:click` native (proposed), or Remix 3-style `on()` mixins?
5. **React island adapter** in v1.x?

## 15. Decision index

| Id | Title | Status |
|---|---|---|
| decision-1 | Author components as valid TSX files | superseded by 11 |
| decision-2 | Scoped styles via `<style>` with reactive CSS variables | superseded by 12 |
| decision-3 | Setup-once components with fine-grained signals, no virtual DOM | accepted |
| decision-4 | Server-first rendering with islands and per-route SPA | accepted |
| decision-5 | Rust compiler on OXC + Lightning CSS, napi-rs + Vite/Rolldown plugin | proposed |
| decision-6 | TS 7 policy: no TS plugins; editor via `.stsx` language server | proposed |
| decision-7 | Compiler-recognised JSX idioms and reactive props destructuring | proposed |
| decision-8 | Reactive core on the alien-signals algorithm | proposed |
| decision-9 | Island protocol: `client:*`, comment markers, data-only serialization | proposed |
| decision-10 | Agent-first DX contract | proposed |
| decision-11 | `.stsx` files (TSX + raw CSS `<style>`) and plain `.tsx` | accepted |
| decision-12 | Raw CSS, `$name` build-time constants, no reactive CSS | accepted |
| decision-13 | Async components on server and client with Suspense / ErrorBoundary | accepted |
| decision-14 | Style scope follows placement: component, file, global | accepted |
| decision-15 | Working package name `lumen` until publishing | accepted |
| decision-16 | Backlog workflow; decisions only after user approval | accepted |

## 16. Research references

- **TASK-1** (Prism): framework runtimes and benchmarks.
  - js-framework-benchmark Chrome 154: https://krausest.github.io/js-framework-benchmark/2026/chrome154.html
  - alien-signals: https://github.com/stackblitz/alien-signals
  - Solid 2 RC: https://github.com/solidjs/solid/discussions/2995
  - Vue Vapor `createFor`: https://github.com/vuejs/core/blob/minor/packages/runtime-vapor/src/apiCreateFor.ts
  - Remix 3 hydration: https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md
  - Declarative partial updates: https://developer.chrome.com/blog/declarative-partial-updates
  - TSRX: https://tsrx.dev/
- **TASK-2** (Photon): toolchain and editor.
  - dom-expressions compiler: https://github.com/ryansolid/dom-expressions/tree/next/packages/compiler
  - Vize: https://github.com/ubugeeei/vize
  - Rolldown hook filters: https://rolldown.rs/apis/plugin-api/hook-filters
  - TS 7.1 plan: https://github.com/microsoft/TypeScript/issues/63703
  - VS Code embedded languages: https://code.visualstudio.com/api/language-extensions/embedded-languages
  - oxfmt embedded formatting: https://oxc.rs/docs/guide/usage/formatter/embedded-formatting
- **Verified locally on TS 7.0.2:**
  - `jsxImportSource` resolution and `IntrinsicElements` typing (TASK-2).
  - Async components via `JSX.ElementType` (this session).
