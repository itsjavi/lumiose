---
id: doc-1
title: Lumen architecture specification
type: specification
created_date: '2026-10-08 10:28'
updated_date: '2026-10-08 11:35'
tags:
  - architecture
  - spec
---
# Lumen architecture specification

> Status: **draft v0.1 for review**. Owner: Lux (architect). Milestone: m-0. Tracking task: TASK-3.
> Product name: **Lumen**. Working package name: **`lumen-jsx`**, because the npm name `lumen` is taken (see §14).
> Normative words: **must**, **should**, **may**. Code samples are normative for API shape, not for internals.
>
> ⚠️ **Revision pending (v0.2, TASK-3).** This version is out of date in several ways:
> - decision-11 (`.stsx` + `.tsx` files) and decision-12 (raw CSS `<style>` blocks, `$name` build-time constants, no reactive CSS) supersede decisions 1–2.
> - decision-13 adds async components on the client with Suspense.
> - decision-14 scopes styles by placement (component, file, global).
> - decision-15 renames the package to `lumen` (this version still says `lumen-jsx`).
>
> Sections 0, 4.4, 4.5, 5, 7.3 and 9 still describe the old design. Decisions 5–10 are proposals pending user approval.

## 0. Summary

Lumen is a TypeScript 7-first web framework:

- **Authoring:** components are valid `.tsx`.
- **Components:** each component's body runs once (setup). State is held in signals.
- **Styles:** CSS is scoped by default and written in a `<style>{css`…`}</style>` element. `${}` values become reactive CSS custom properties, and `<style global>` emits unscoped CSS.
- **Compiler:** written in Rust on OXC and Lightning CSS. It turns JSX into cloned HTML templates plus fine-grained DOM bindings for the client, and into string concatenation for the server.
- **Rendering:** server-first. Pages ship zero JavaScript by default. Interactive parts are islands, marked at the usage site (`<Counter client:visible />`), and any route can opt into SPA mode.
- **Platform:** web standards (`Request` / `Response`, `AbortSignal`, `FormData`), a Vite 8 plugin, and the normal npm, lint, format and test ecosystem.
- **Agent-first:** a small, unambiguous API, plus documentation that ships with the package and matches its version, stable diagnostic codes, a CLI with JSON output, and an MCP server.

```tsx
// src/components/Counter.tsx
import { signal, computed, css } from "lumen-jsx";

export function Counter({ start = 0, label }: { start?: number; label: string }) {
  const count = signal(start);
  const double = computed(() => count() * 2);

  return (
    <button class={["counter", { hot: count() > 5 }]} onClick={() => count.update((c) => c + 1)}>
      {label}: {count()} (×2 = {double()})
      <style>{css`
        .counter { padding: 0.5rem 1rem; border-radius: 0.5rem; }
        .hot { background: ${count() > 10 ? "crimson" : "orange"}; }
      `}</style>
    </button>
  );
}

// src/routes/index.tsx: a server component; ships no JS except the island
import { Counter } from "../components/Counter.tsx";

export default function Home() {
  return (
    <main>
      <h1>Hello Lumen</h1>
      <Counter client:visible label="Clicks" />
      <style global>{css`
        body { font-family: system-ui; margin: 0; }
      `}</style>
    </main>
  );
}
```

## 1. Goals and non-goals

**Goals**

1. **TS 7 first.** Lumen code type-checks with stock TS 7 `tsc` and its language service, with no plugins.
2. **Styles first-class.** Scoped CSS, reactive values in CSS, global styles without `:global` noise, and no CSS-in-JS runtime.
3. **Performance.** On paper, Lumen should beat the latest React on js-framework-benchmark and land in the Solid / Svelte 5 / Vue Vapor class. SSR throughput should be in the same class as the fastest string-based renderers.
4. **Rendering modes.** CSR, SSR (streaming), SSG, islands and SPA, all from one component model.
5. **Ecosystem compatibility.** Vite 8 / Rolldown, Vitest, oxlint / ESLint, oxfmt / Prettier, Tailwind, CSS Modules, any npm package, and web components.
6. **Agent-first.** The obvious code is the correct code. The rules are machine-checkable, diagnostics are machine-readable, and documentation is version-matched and available locally.

**Non-goals for v1**

- No compatibility layer for React components. A React island adapter may come later (§14).
- No virtual DOM, no custom file extension, no CSS-in-JS runtime.
- No resumability.
- No RPC "server functions" magic. Lumen uses explicit endpoints and form actions instead.
- No native mobile targets.

### 1.1 Positioning (October 2026)

| | Authoring | Reactivity / rendering | Styles | Server model | Gap Lumen fills |
|---|---|---|---|---|---|
| Solid 2 (RC) | TSX (TSRX frontend coming) | signals, compiled fine-grained | none built in | SolidStart: SSR + full hydration | scoped reactive styles; server-first islands |
| Svelte 5 | `.svelte` | runes, compiled | scoped `<style>` | SvelteKit: SSR + full hydration | valid TSX, so no custom tooling |
| Vue 3.6 Vapor (RC) | `.vue` SFC / JSX | alien-signals, compiled | scoped `<style>`, `v-bind()` | Nuxt: SSR + full hydration | valid TSX; zero-JS server parts |
| Remix 3 (1.0, Oct 2026) | TSX | setup + `handle.update()`, virtual DOM | `css()` mixin | islands (`clientEntry`) + `<Frame>` | fine-grained performance; CSS that is CSS |
| Astro 7 | `.astro` + any framework | depends on the framework | scoped `<style>` | islands, server islands | one component model across server and client; valid TSX |
| Marko 6 | `.marko` | compiled graph, resumable | scoped styles | streaming, resumable | TSX familiarity |
| TSRX / Ripple / Octane | TSX superset (`@if`, `<style>`) | various | sibling-scoped `<style>` | various | no new syntax; standard tooling and TS 7 work today |

Lumen's differentiator is the combination of four things:
1. **Valid TSX with no new syntax.** Stock TS 7, linters, formatters and agents work on day one.
2. **Reactive scoped CSS** with `<style global>`.
3. **Server-first islands plus per-route SPA** from one component model.
4. **An agent-first contract** (§10).

A Rust compiler on its own is no longer distinctive: Solid 2 and Astro 7 have one too.

## 2. Design principles

These rules settle tie-breaks during design and review.

1. **Valid TSX, standard semantics.** Lumen-specific meaning is carried only by constructs TSX already parses: elements, attributes, namespaced attributes and the `css` tag. TypeScript must never see code it would reject.
2. **One obvious way.** Each concept gets exactly one blessed API. Alternatives are lint errors, not documented options.
3. **Write it like React, run it like Solid.** Familiar idioms compile to fine-grained code: `.map()`, ternaries, `&&`, destructured props and `onClick`. Where familiar idioms would silently break, the compiler reports an error with a fix.
4. **Explicit boundaries.** Server/client (`client:*`), scoped/global (`<style global>`), tracked/untracked (`untrack`) are visible in the code.
5. **Web platform first.** Prefer web standards and native features over framework inventions.
6. **Zero-cost abstractions.** Anything decidable at build time is decided at build time: scoping, static CSS values, templates and event delegation.
7. **Every rule is checkable.** Each rule in the docs maps to a type error, a compiler diagnostic (`LUMxxxx`) or a lint rule.

## 3. System overview

```
             ┌──────────────── authoring (.tsx) ────────────────┐
             │ components · routes · <style>{css`…`} · client:*  │
             └──────────────┬──────────────────────┬───────────┘
                            │ Vite 8 / Rolldown    │ TS 7 tsc + native LS (no plugins)
                            ▼                      │ oxlint(+plugin) · oxfmt (formats css``)
            ┌───────── @lumen-jsx/vite (JS plugin, enforce: pre, Rust-side hook filters) ─────────┐
            │  calls  @lumen-jsx/compiler (napi-rs v3; wasm32-wasip1 fallback)                     │
            │   lumen_jsx_compiler (Rust): OXC parse → semantic → analyze → codegen(client|server) │
            │   lumen_jsx_css      (Rust): Lightning CSS scoping, vars, nesting, minify            │
            └───────┬──────────────────────────────┬───────────────────────────┬─────────────────┘
                    │ client env (islands/SPA)     │ ssr env                   │ css virtual modules
                    ▼                              ▼                           ▼
        lumen-jsx/dom runtime            lumen-jsx/server runtime        Vite CSS pipeline
        (signals, templates,            (string SSR, streaming,          (HMR, PostCSS/Tailwind,
         bindings, hydration)            islands, Suspense)               chunking, minify)
                    └───────────── lumen-jsx app layer: routes, endpoints, actions, adapters ─────────┘
 Tooling: `lumen` CLI (dev/build/check/typegen/docs/explain/mcp) · VS Code ext (TextMate injection + LSP)
```

### 3.1 Repository layout (pnpm workspace + Cargo workspace)

```
crates/
  lumen_jsx_compiler/   pure transform core (no I/O): analysis, client/server codegen, diagnostics
  lumen_jsx_css/        Lightning CSS-based scoping, interpolation → custom properties
  lumen_jsx_napi/       napi-rs v3 bindings (+ wasm32-wasip1-threads fallback build)
  lumen_jsx_wasm/       wasm-bindgen single-threaded build for the browser playground
packages/
  lumen-jsx/            runtime + app layer + CLI + types (the one package users install)
    src/core/           signals, owner tree, context, scheduling (isomorphic)
    src/dom/            client renderer, delegation, lists, hydration
    src/server/         SSR string runtime, streaming, islands, Suspense
    src/app/            router (file routes, SPA router), endpoints, actions, adapters API
    src/vite/           Vite plugin (re-exported as lumen-jsx/vite)
    src/cli/            `lumen` binary
    docs/               version-matched docs shipped in the npm package
  language-server/      @lumen-jsx/language-server (Node LSP: CSS-in-css`` + compiler diagnostics)
  vscode/               VS Code extension (TextMate injection grammar + LSP client + snippets)
  eslint-plugin/        eslint-plugin-lumen-jsx (works under ESLint and oxlint JS plugins)
  create/               create-lumen-jsx
  testing/              @lumen-jsx/testing (render, queries; Vitest-first)
  adapters/             @lumen-jsx/adapter-{node,bun,deno,cloudflare,vercel,netlify,static}
apps/
  docs/                 docs site, built with Lumen (SSG); emits llms.txt / llms-full.txt
  playground/           in-browser REPL on lumen_jsx_wasm
benchmarks/
  js-framework-benchmark/   keyed implementation (+ CI comparison vs solid/svelte/vue/react)
  ssr/                      SSR throughput suite
  agent-evals/              agent-task evaluation suite (§10.6)
examples/
```

**Publishing.** Users install one package, `lumen-jsx`. It exports the runtime subpaths (`lumen-jsx`, `/dom`, `/server`, `/router`, `/jsx-runtime`, `/vite`, `/testing-internal`) and the `lumen` binary. Compiler binaries ship as optional platform dependencies (`@lumen-jsx/compiler-<platform>`) plus a wasm fallback, following the Rolldown / OXC / dom-expressions pattern. Tree-shaking and conditional exports (`browser` / `node` / `worker`) keep server code out of client bundles.

## 4. Authoring model

### 4.1 Components

- A component is a **PascalCase function** that returns JSX. It can be a declaration or an arrow function, exported or not.
- **Its body is the setup scope, and it runs exactly once per instance.** Reactivity lives in signals and in JSX bindings, never in re-running the function.
- Props are the single parameter.
  - At call sites the compiler passes dynamic props as **getters**, so reading `props.x` is reactive.
  - **Destructuring is supported and stays reactive.** The compiler rewrites references to destructured bindings into `props.x` reads, applying default values with `undefined` semantics.
  - `...rest` compiles to a reactive rest proxy.
  - This applies only to component parameters; destructuring elsewhere has normal JavaScript semantics.
- `children` is a prop. The compiler passes JSX children lazily, and inserting `{children}` mounts them. Children should be inserted once. Inserting them twice triggers `LUM2005` with a fix (`children` is a value, not a factory; use a render-prop function for repeated rendering).
- Named slots are just props: `<Card header={<h2>Title</h2>}>…</Card>`.
- Render props are plain functions: `<List each={items} row={(item) => <li>{item.name}</li>} />`.
- `ref`:
  - `ref={(el) => …}` is a callback ref.
  - `const input = ref<HTMLInputElement>()` creates a signal-like ref. Pass it as `ref={input}` and read it with `input()`.
- **Early returns based on reactive values are an error** (`LUM2003`), because setup runs once. Conditional UI goes inside JSX (§4.3).

### 4.2 Reactivity API (`lumen-jsx`)

| API | Shape | Notes |
|---|---|---|
| `signal(v, opts?)` | read `s()`, write `s.set(v)` / `s.update(fn)`, `s.peek()` | `opts.equals` defaults to `Object.is`; `false` disables the check |
| `computed(fn)` | read `c()` | Lazy, cached and glitch-free. `fn(prev)` receives the previous value |
| `effect(fn)` | returns a disposer | Runs after DOM updates. `fn` may return a cleanup |
| `store(obj)` | deep reactive proxy | Mutate directly (`todos.push(x)`, `todo.done = true`); tracking is per property |
| `resource(fetcher, opts?)` | `r()`, `r.loading()`, `r.error()`, `r.refetch()` | Async data. Integrates with `<Suspense>`. See §6.5 |
| `batch(fn)`, `untrack(fn)` | | Writes are batched automatically in handlers; `batch` is rarely needed |
| `onMount(fn)`, `onCleanup(fn)` | owner-scoped | `onMount` runs after the first DOM insertion |
| `lifetime()` | returns an `AbortSignal` | Aborted when the owner is disposed. Pass it to `fetch` and `addEventListener` (Remix 3 `handle.signal` idea) |
| `createContext(default)`, `provide(ctx, v)`, `inject(ctx)` | setup-scope calls | Context flows through the owner tree, server and client |

**Rules enforced by the compiler.** Every rule has a diagnostic code, and the docs include a "Common mistakes" page generated from these rules.

- `LUM2001` **stale derived value.** A setup-scope `const` initialised from a signal or prop read, then used in JSX or an effect, will never update. The fix is `computed(() => …)`. Initialisers passed straight into `signal(…)` are allowed and are treated as initial values.
- `LUM2002`: a signal is written during render or inside a `computed`.
- `LUM2003`: an early return depends on a reactive value.
- `LUM2004`: a component is called as a function (`Counter()`) instead of being used as JSX.

### 4.3 JSX semantics

**Bindings.** In children and attributes:

- Literals and plain identifiers are static.
- Any expression containing a call or a member access becomes a **fine-grained binding**: a render effect bound to exactly that DOM node or attribute.
- `untrack()` opts out.

**Compiled idioms.** These are the blessed ways to write control flow.

| You write | Compiles to | Notes |
|---|---|---|
| `{items().map((it, i) => <Row key={it.id} … />)}` | keyed list reconciliation (`list()`) | `key` is optional; without it, items are keyed by reference. Inside the callback, `i` becomes a reactive index (`LUM2006` if `i` escapes the JSX) |
| `{cond() ? <A/> : <B/>}` / `{cond() && <A/>}` | memoised branch (`branch()`) | A branch is recreated only when the condition's truthiness changes |
| `{fn()}` returning arrays, nodes or strings | dynamic insert | Fallback path, unkeyed |

Runtime components remain for cases idioms can't express: `<Dynamic component={…}>`, `<Portal mount={…}>`, `<Suspense fallback>`, `<ErrorBoundary fallback>`. There is deliberately **no** `<For>` / `<Show>`, to keep one obvious way.

**Elements and attributes**

| Feature | Rule |
|---|---|
| `class` | `string \| (string \| false \| null \| undefined)[] \| Record<string, boolean>`, combinable in arrays. Compiled to `className` or `classList.toggle` per key. `className` is a type error |
| `style` | `string` or an object with **kebab-case** CSS property keys, including custom properties `"--x"`. Typed via csstype. Compiled to `setProperty` per key |
| events | `onClick={fn}` is **delegated** for bubbling events (Solid's list). `on:scroll={fn}` attaches a native, non-delegated listener. Handlers receive the typed native event (`currentTarget` typed) |
| `bind:value`, `bind:checked` | two-way binding to a **writable signal** (`bind:value={name}`). Typed per element |
| `attach={[tooltip("Hi"), clickOutside(close)]}` | attachments: `(el) => cleanup?`, re-run when their reactive inputs change. Borrowed from Svelte 5 attachments and Remix 3 mixins |
| `innerHTML={html}` | allowed. The lint rule `lumen-jsx/no-unsafe-html` warns unless the value comes from `trustedHTML()` |
| `client:*` | island directives on component elements only (§7.2) |
| `for`, `tabindex`, `aria-*`, `data-*` | standard HTML attribute names, not React aliases |

### 4.4 Styles

Accepted in decision-2. This section gives the mechanics.

1. **Syntax.** One or more `<style>{css`…`}</style>` elements anywhere in a component's JSX, conventionally last.
   - The child must be a `css` tagged template. The type is `Stylesheet`, so a string child is a type error. The tag is named `css` so that editors, oxfmt and Prettier format the embedded CSS.
   - `css` used outside `<style>` is a compile error (`LUM3004`).
   - The compiler removes `<style>` from the rendered output. Inside `<svg>`, `<style>` keeps native SVG semantics.
2. **Scope unit: the module (file).** Every element in every template in the file gets a `data-l-<hash>` attribute, baked into the static template HTML, so it costs nothing at runtime.
   - `<hash>` is a stable base36 hash of the root-relative path, which keeps diffs and snapshots stable.
   - Children passed from another module carry *their* module's hash, so slot content is styled by its author.
3. **Selector rewrite.** The last compound selector gets `[data-l-<hash>]` before any pseudo-element. This adds a specificity of (0,1,0), the same as Vue and Svelte, so scoped rules reliably beat global element rules regardless of the order code-split CSS loads in.
   - `:global(sel)` leaves `sel` unscoped.
   - `:deep(sel)` scopes only the left side (`.a :deep(.b)` → `.a[data-l-x] .b`), for styling child-component internals.
   - `@keyframes` names are scoped, and `animation` / `animation-name` references are rewritten.
   - Custom properties are never scoped, so design tokens flow through.
4. **`<style global>`** emits the whole block unscoped, with no `:global` noise, for resets, tokens, fonts and app-wide rules.
5. **Interpolations `${expr}`.**
   - *Position.* Allowed only in declaration **value** positions. `${}` in selectors, property names, at-rule preludes, `url()` or keyframe names is an error (`LUM3001`).
   - *Static.* Expressions the compiler can evaluate at build time (literals, module-level `const` literals, imported `const` tokens from `.ts` modules) are **inlined**.
   - *Dynamic.* Anything else becomes `var(--l-<hash>-<n>)`. On the client, a binding sets `el.style.setProperty("--l-<hash>-<n>", value)` on the component instance's **root element(s)**: the top-level elements of the JSX returned by the component that contains the `<style>`. On SSR, the value is inlined into the root's `style` attribute. Custom properties inherit, so every descendant sees per-instance values. This is Vue's `v-bind()` in CSS, made fine-grained.
   - *No element root.* A dynamic interpolation in a component whose root is a component or a text node is an error (`LUM3002`). The fix is to wrap in an element (`display: contents` works).
   - *Global blocks.* Dynamic interpolations in `<style global>` are an error (`LUM3003`). Global CSS is static. Dynamic theming sets custom properties on an element.
6. **Pipeline.**
   - Extracted CSS becomes a virtual module (`File.tsx?lumen&type=style&lang.css`) imported by the compiled JS. Vite's CSS pipeline then handles HMR (CSS-only edits do not reload components), PostCSS / Tailwind, chunk-level extraction and minification (Lightning CSS).
   - SSR emits `<link>` tags for every module's CSS that the page renders, including server-only components, from the Vite manifest. Critical-CSS inlining is optional.
7. **Diagnostics.** `LUM3005` flags an unused scoped selector, i.e. one that can't match any element in the module's templates and has no dynamic `class` that could produce it. `lumen check` can also report static `class` names that no style defines, opt-in because utility-class users would find it noisy.
8. **Interoperability.** `import "./x.css"`, CSS Modules (`*.module.css`) and Tailwind v4 work unchanged through Vite.
9. **Later (v1.x):** typed design tokens (`defineTokens()` → global custom properties + a typed object usable in `css` interpolations, inlined statically) and an opt-in native `@scope` output mode.

### 4.5 Types (`jsxImportSource: "lumen-jsx"`)

`tsconfig.json`: `"jsx": "preserve", "jsxImportSource": "lumen-jsx"`. TypeScript resolves JSX types from `lumen-jsx/jsx-runtime` (verified on TS 7.0.2, TASK-2).

- `IntrinsicElements` derive from `HTMLElementTagNameMap` / `SVGElementTagNameMap` with Lumen props.
  - `<style>` is `{ children: Stylesheet; global?: true }`.
  - Events are typed as `on${Capitalize<keyof HTMLElementEventMap>}` and `on:${keyof HTMLElementEventMap}`.
  - `bind:value` / `bind:checked` are typed per element.
- `IntrinsicAttributes` add `key?` and the `client:*` directives (§7.2) to every component.
- `className`, camelCase `style` keys and `htmlFor` are absent, so TypeScript reports them. The Lumen docs map each of these errors to its fix.

## 5. Compiler (Rust)

### 5.1 Pipeline

```
source.tsx ─▶ oxc_parser (TS+JSX) ─▶ oxc_semantic (scopes/symbols/refs)
   ─▶ analyze: components, props destructuring, setup-scope reads, compiled idioms,
               <style> extraction, island sites, diagnostics
   ─▶ lumen_jsx_css: Lightning CSS parse → visitor (scope selectors, :global/:deep,
               keyframes, interpolation placeholders) → targets/nesting → css + var map
   ─▶ codegen(target = client | server) via VisitMut + AstBuilder (keep original spans)
   ─▶ oxc_codegen + oxc_sourcemap ─▶ { code (TS types intact), map, css, diagnostics, meta }
```

- **Inputs:** `{ filename, source, target: "client" | "server", dev, hmr, root, cssTargets }`.
- **Outputs:**
  - `code` with TS types still in place. Vite's OXC transform strips them afterwards for tsconfig parity; in-process stripping is a later optimisation.
  - The source `map`.
  - `css` and its own map. Lightning CSS has no input offset, so extracted CSS is whitespace-padded to its original offsets.
  - Structured `diagnostics` (§5.5).
  - `meta`: components, islands, routes, style hashes. The CLI, LSP and MCP all consume `meta`.
- **Implementation rules** (TASK-2):
  - Pin every `oxc_*` crate and `lightningcss` to exact versions and upgrade deliberately behind a golden-fixture suite.
  - Use `oxc_ast_visit` `VisitMut` + `AstBuilder` + `oxc_semantic`, and avoid `oxc_traverse`.
  - The core crate is pure (no I/O), so napi, wasm, LSP and tests share it.
- **Prior art:**
  - Reference design: `@dom-expressions/compiler` (Solid's official OXC compiler, MIT). Reuse its ideas, fixtures and code selectively with attribution; do not fork it.
  - Structural reference: Vize (OXC + Lightning CSS + napi + wasm + LSP).
  - Borrow from `solid-1x-compiler` the idea of an **execution-contract trace**: per expression, whether it is tracked, untracked, run once or deferred, exposed through LSP hovers and `lumen explain`.

### 5.2 Client output (illustrative)

```js
import { signal, computed } from "lumen-jsx";
import { template, insert, delegateEvents, setVar, className } from "lumen-jsx/dom";
import "/src/components/Counter.tsx?lumen&type=style&lang.css";

const _t0 = /*#__PURE__*/ template(`<button data-l-k3x9a2><!></button>`);

export function Counter(props) {
  const count = signal(props.start ?? 0);
  const double = computed(() => count() * 2);
  const _el = _t0();                                   // cloneNode(true), or claim during hydration
  className(_el, () => ["counter", { hot: count() > 5 }]);
  _el.$$click = () => count.update((c) => c + 1);       // delegated
  insert(_el, () => [props.label, ": ", count(), " (×2 = ", double(), ")"], _el.firstChild);
  setVar(_el, "--l-k3x9a2-0", () => (count() > 10 ? "crimson" : "orange"));
  return _el;
}
delegateEvents(["click"]);
```

```css
/* Counter.tsx?lumen&type=style&lang.css */
.counter[data-l-k3x9a2] { padding: 0.5rem 1rem; border-radius: 0.5rem; }
.hot[data-l-k3x9a2] { background: var(--l-k3x9a2-0); }
```

- Templates are hoisted and instantiated by cloning.
- Elements are reached by `firstChild` / `nextSibling` walks.
- Static text and attributes are baked into the template HTML.
- Adjacent dynamic text is merged into one insert, to cut down on effects and DOM nodes.

### 5.3 Server output (illustrative)

```js
import { ssr, escape, attrs, vars, signal, computed } from "lumen-jsx/server";
export function Counter(props) {
  const count = signal(props.start ?? 0);
  const double = computed(() => count() * 2);
  return ssr(["<button", "", ">", "</button>"],
    attrs({ class: ["counter", { hot: count() > 5 }], "data-l-k3x9a2": "" },
          vars({ "--l-k3x9a2-0": count() > 10 ? "crimson" : "orange" })),
    escape([props.label, ": ", count(), " (×2 = ", double(), ")"]));
}
```

- On the server, signals are plain cells: no tracking, no effects, and `computed` is evaluated lazily once.
- Templates become static string arrays.
- Hydration markers are emitted **only inside island subtrees** (§7.4). Server-only components produce bare HTML.

### 5.4 Islands at compile time

- In the **server** build, `<X client:visible … />` compiles to `island(ref, X, props, strategy)`.
  - `ref` is the resolved module specifier plus export name of `X`, which the compiler knows from the import or local export.
  - A non-exported local component used as an island is an error (`LUM4001`).
- The Vite plugin collects island refs into a manifest and emits one client entry per island module, code-split and shared-chunked by Rolldown.
- In the **client** build, `client:*` attributes are type-only: they are stripped and never reach the DOM.

### 5.5 Diagnostics

- **Shape:** `{ code: "LUM2001", severity, message, span, labels[], help, fix?: TextEdit[], docs: "https://…/errors/LUM2001" }`.
- **Code ranges:**
  - 1xxx syntax / unsupported
  - 2xxx reactivity
  - 3xxx styles
  - 4xxx islands / server-client boundary
  - 5xxx routing
  - 9xxx internal
- Codes are **stable forever**. A retired code stays documented.
- Human output shows code frames, like rustc or Elm. `--format json` gives machine-readable output.
- The same diagnostics surface through the Vite overlay, `lumen check`, the LSP and MCP.

### 5.6 Distribution and the Vite plugin

- **Compiler packages:**
  - napi-rs v3 platform packages (`@lumen-jsx/compiler-darwin-arm64`, …).
  - A `wasm32-wasip1-threads` fallback (StackBlitz, unusual platforms).
  - A single-threaded `wasm-bindgen` build for the playground, which avoids needing COOP/COEP headers.
- **`lumen-jsx/vite`:**
  - Runs as `enforce: "pre"` with a Rust-side hook filter (`/\.[cm]?[jt]sx$/`), so non-matching modules never cross into JS.
  - Picks the client or server generator per Vite environment.
  - Serves the CSS virtual modules.
  - Handles HMR: a component module is hot-swapped and its instances remount. State-preserving HMR is a later goal.
  - Builds the island manifest.
  - Works in plain Rolldown too.
- **Known cost:** a JS-boundary plugin is somewhat slower than in-core Rolldown transforms (string in, string out). Accept this for v1 and track Rolldown's raw-AST-transfer work.

## 6. Runtime

Budget: the client runtime for core + DOM + lists + hydration should be **≤ 5 kB min+brotli**, in the same class as Solid, ivi and Marko. Islands load only what they use.

### 6.1 Reactive core (decision-8)

- **Algorithm.** An alien-signals-style push-pull graph. Vue 3.6 builds on it, and it is the fastest core measured on js-framework-benchmark (1.06 versus vanilla's 1.05).
  - Every node is `{ deps, depsTail, subs, subsTail, flags }`.
  - Every edge is a single `Link` object sitting in two intrusive doubly-linked lists.
  - **Push:** a write marks downstream nodes `Dirty` or `Pending` by setting flags.
  - **Pull:** a read runs `checkDirty`, which recomputes only what is actually stale. The result is glitch-free.
  - When a computation re-runs, it walks its existing links with a `depsTail` cursor. Stable dependencies therefore allocate nothing.
  - No `Set` or `Map` per edge, and no recursion.
- **Lifecycle.** A `computed` is lazy, and it **unlinks itself when nothing observes it**, so it can be garbage-collected. This idea comes from Svelte's CONNECTED flag and Preact.
- **Source.** Vendor the algorithm from `alien-signals` (MIT, with attribution) behind Lumen's own API. Keep the API shape compatible with TC39 Signals naming, but take no dependency on that proposal (Stage 1, stalled).
- **Owner tree.** Owners scope cleanup, context and error boundaries, as in Solid. Components, islands, list rows and branches each create an owner.

### 6.2 Scheduling

- **Reads are synchronous.** A read always sees the latest write. This avoids the read-after-write surprise of Solid 2's microtask-deferred writes.
- **Effects are batched.**
  - The delegated event dispatcher wraps each handler in a batch.
  - Writes made outside a batch (timers, fetch callbacks) schedule a microtask flush.
  - `flushSync()` is the escape hatch.
- **Flush order:** pending computeds are pulled, then render effects (DOM bindings, in owner/tree order), then user `effect`s, which run after the DOM is updated.

### 6.3 DOM renderer

- **Templates.**
  - `template(html)` parses minified HTML (optional closing tags omitted) into a `<template>` once, then clones it.
  - Elements are reached through precomputed `firstChild`/`nextSibling` paths.
  - Text holes are positioned by construction order, in the ivi style, so no marker nodes are needed where the structure already disambiguates. A comment anchor is used only where it is required.
- **Bindings.**
  - The compiler emits `effect(compute, apply)` pairs, as Solid 2 does. Equality short-circuits before touching the DOM, and the split leaves room to hold commits for async transitions later.
  - Expressions proven non-reactive (literals, imports of `const`, values that are not signals) become plain one-time writes with no effect.
  - The compiler may merge several cheap bindings of one template that share sources into a single effect, as Svelte's `template_effect` does. This is a tuning knob validated against js-framework-benchmark, not a semantic change.
- **Events.**
  - Delegated handlers are stored on the node (`el.$$click`).
  - A data slot (`el.$$clickData`) lets list rows avoid per-row closures. The compiler hoists `onClick={() => select(row.id)}` into a shared handler plus row data when the closure captures only the row.
  - Delegation listens on the island or app root, not on `document`. An ancestor that calls `stopPropagation` outside Lumen therefore can't silently swallow events (a known Vue Vapor issue).
  - `on:x` always attaches a native listener.
- **Keyed lists (`list()`).** The algorithm, in order:
  1. Trim the common prefix and suffix.
  2. Take fast paths:
     - Pure append and pure removal.
     - When the list is the parent's only content, clear it with `textContent = ""`.
     - Detect two-element swaps.
  3. Use a longest increasing subsequence (LIS) for minimal moves in the general case.

  The algorithm follows Vue Vapor's `createFor` and ivi. Each row gets its own owner. The index is a signal only if the callback uses it.
- **Selector optimisation.** The compiler detects the pattern `item.key === sig()` (and `!==`) inside `.map` callbacks. A typical case is `class={{ selected: row.id === selected() }}`. It compiles the pattern to a `selector()` primitive, so a selection change updates only 2 rows (O(1)) instead of re-evaluating every row. Vue Vapor does the same; it is the main remaining gap in Svelte 5's js-framework-benchmark results.
- **Branches.** `branch()` memoises the condition's truthiness and disposes the inactive owner.

### 6.4 Server runtime

- **Server components** are plain functions returning strings, built by concatenating template parts. Escaping is fused into the compiled code. There are no component instance objects or reactive graph on the server: signals are cells and `computed` runs at most once.
- **Streaming** writes to a web `ReadableStream`. Chunks are flushed at `<Suspense>` boundaries and island ends.
- **Serialization** of island props and streamed data uses **data-only formats**: JSON, or seroval in JSON mode, which never `eval`s. The server validates what it accepts. These are the lessons of CVE-2025-55182 (the React Flight remote code execution) and of SolidStart v2 defaulting to JSON.

### 6.5 Async on the client

- `resource(fetcher)` gives `r()`, `loading()`, `error()` and `refetch()`, plus an `AbortSignal` passed to the fetcher.
- Reads while pending throw to the nearest `<Suspense>`, unless `r.latest()` is used to keep showing stale data.
- Solid 2-style async inside the reactive graph (`computed(async …)`) is a v1.x candidate, once Solid 2's semantics settle.

## 7. Rendering modes

### 7.1 Route modes

Each route module may export `export const mode = "static" | "server" | "spa"`, inherited from the nearest layout. The default is `"static"` when the route has no request-time dependencies, otherwise `"server"`. The resolved mode is shown by `lumen routes`.

| Mode | When HTML is produced | JavaScript shipped | Navigation |
|---|---|---|---|
| `static` (SSG) | at build time; dynamic params via `export async function staticPaths()` | islands only | MPA (+ cross-document View Transitions) |
| `server` (SSR) | per request, streamed | islands only | MPA |
| `spa` | `ssr: true` (default): SSR + whole-tree hydration; `ssr: false`: client-rendered shell | whole SPA subtree | client router within the SPA subtree |

An SPA subtree is implemented as **one root island**: the SPA layout, implicitly `client:load`. So there is a single hydration mechanism, and SPA and MPA regions coexist in one app.

### 7.2 Islands

- **Directives.** Islands are marked at the **usage site** with `client:*`, so the hydration strategy is a decision made where the component is used, and it is visible to reviewers and agents.

  | Directive | Hydrates when |
  |---|---|
  | `client:load` | as soon as possible (module preloaded) |
  | `client:idle` | `requestIdleCallback` (with timeout) |
  | `client:visible` | `IntersectionObserver` (optional `rootMargin` via `client:visible="200px"`) |
  | `client:media="(max-width: 600px)"` | the media query matches |
  | `client:only` | client-render only; no SSR (for browser-only libraries) |

- **Props.**
  - Island props must be serializable: JSON plus `Date`, `Map`, `Set`, `BigInt`, `URL`, `RegExp`, typed arrays, cyclic references, and `Promise` (streamed). Lumen uses a seroval-class serializer.
  - Functions or class instances are an error: a dev-time runtime error plus a `lumen check` error (`LUM4002`). TS 7 has no API for type-aware checks until 7.1, so this is enforced at runtime and with best-effort static analysis.
- **Children.** Children of an island are server-rendered, passed as static HTML and inserted where the island renders `{children}`. This follows Astro's slot model. They cannot be reactive inside the island unless they are themselves islands. Islands may nest.
- **Boundaries.**
  - Modules named `*.server.ts(x)` and anything under `src/server/` are forbidden in client module graphs. Importing one is a build error (`LUM4003`) that names the import chain.
  - Client-only browser APIs used at module scope in server-rendered code produce a `LUM4004` warning.
- **No wrapper element.** Islands are delimited by comment markers (§7.4). Astro's `<astro-island>` wrapper breaks child-combinator CSS (`ul > li`) and structural pseudo-classes, so Lumen avoids it.

### 7.3 Streaming SSR and async server components

- **Async server components.** Components that only run on the server may be `async function` and `await` data directly, which is the colocated data-fetching idiom agents already know from RSC and Astro frontmatter.
  - An async component reachable from a client graph is an error (`LUM4005`). Client code uses `resource()`.
- **Rendering API.** `renderToStream(app, { request })` returns a web `ReadableStream`.
  - Without boundaries, rendering is in-order: HTML before the first unresolved `await` flushes immediately.
  - `<Suspense fallback={…}>` enables **out-of-order streaming**. The fallback is sent first.
  - When the content resolves, Lumen emits native declarative partial updates (`<template for>` + `<?marker>`, in the HTML standard and shipped in Chrome 150) where the browser supports them.
  - Otherwise a `<template data-l-s=ID>` chunk plus a tiny shared swap function (~300 B) moves the content into place.
  - Islands inside a streamed chunk boot after the swap.
- **Head and CSS.** `<Head>`, `<Title>` and `<Meta>` collect into `<head>`. CSS `<link>` tags and island `modulepreload` hints are flushed in the first chunk, from the Vite manifest.
- **Errors.** `<ErrorBoundary>` works on both server and client. Errors in the server stream after headers are sent render the boundary fallback in place.

### 7.4 Hydration protocol (decision-9)

- **Positional claiming, no per-element keys.**
  - The same compiled client code serves both create and hydrate. `template()` either clones the template, or, when a hydration cursor is active, claims the existing node at the current position and walks the same `firstChild`/`nextSibling` paths. This is Svelte 5's model.
  - Solid's `_hk` / `data-hk` keys cost SSR bytes and time (Platformatic SSR benchmark), so Lumen doesn't use them.
- **Comment markers only where structure is ambiguous.**
  - Dynamic blocks (lists, branches, dynamic inserts) are wrapped as `<!--[-->…<!--]-->`.
  - An inactive branch, so the client knows which branch the server rendered: `<!--[!-->`.
  - A separator between adjacent dynamic text nodes: `<!--!-->`.
  - Static content carries no markers.
- **Island markers.**
  - Each island is wrapped as `<!--l:ID-->…<!--/l:ID-->`.
  - All island records for a flush, `{ id, ref, props, strategy }`, go into a single `<script type="application/json" data-l-islands>` per flushed chunk, following Remix 3's one-data-script approach.
- **Loader.**
  - A ~1 kB module script, external and CSP-friendly, is emitted once per page that has islands.
  - It reads the island records, finds the comment ranges with one `TreeWalker` pass, and arms each island's trigger:
    - `load`, `idle`, `media` and `only` need no element.
    - `visible` observes the first element in the range.
  - When a trigger fires, it calls `import(ref)` and then `hydrate(Component, props, range)`.
  - `client:load` islands also get a `modulepreload` hint in `<head>`.
- **Event capture and replay.** Until an island hydrates, the loader captures `click`, `input`, `submit` and `keydown` that target inside its range, and replays them after hydration, as Solid's `_$HY` queue does. A click on a not-yet-hydrated `client:visible` island is therefore not lost.
- **Mismatches.** In development, a structural mismatch throws `LUM4006` with the expected and actual nodes. In production, the island falls back to client-rendering its range.
- **SPA subtrees** use the same protocol, with a single root island.

### 7.4.1 Content Security Policy

- **Default mode.** Per-instance CSS custom properties and `style` props are emitted as inline `style="…"` attributes.
- **`csp: "strict"` mode.** A strict `style-src` (no `'unsafe-inline'` / `style-src-attr`) blocks inline style attributes, so in this mode SSR instead emits:
  - per-instance rules (`[data-l-v="17"]{--l-k3x9a2-0:crimson}`) in a nonce'd `<style>` element in the same chunk;
  - nonces on the loader and swap scripts, with the nonce taken from the request context.
- **Client-side** CSSOM writes (`setProperty`) are always CSP-safe.

### 7.5 Navigation

- **MPA by default.** Full page loads, enhanced with cross-document View Transitions (`@view-transition { navigation: auto; }` opt-in through config) and speculation rules for prefetch (`<script type="speculationrules">`, generated from route config). Both are zero-JS and web-native.
- **SPA router (`lumen-jsx/router`).** Active only inside `spa` subtrees.
  - Built on the Navigation API, with a History API fallback.
  - Supports nested layouts, `<Link>` with hover/viewport prefetch, scroll restoration, and same-document View Transitions.
  - Leaving the SPA subtree is a normal document navigation.
- **Later: server fragments** (Remix 3 `<Frame>`-style). `<Frame src>` streams a server-rendered fragment and can be reloaded from an island (`frame.reload()`). This gives partial-page updates without a full SPA.

## 8. App layer

- **File routes** under `src/routes/`:
  - `index.tsx`, `about.tsx`, `blog/[slug].tsx`, `docs/[...path].tsx`, `(marketing)/pricing.tsx` (group), `_layout.tsx` (wraps siblings and children), `_404.tsx`, `_error.tsx`.
  - Endpoints are `*.ts` files exporting `GET` / `POST` / … handlers.
- **Page module exports:**
  - `default` (component, may be async on server/static routes)
  - `mode`
  - `staticPaths`
  - `action` (POST form handler, progressive enhancement: works without JS; islands may enhance with `submit()`)
  - `headers`
  - `meta`
- **Context.** Pages and endpoints receive `{ request, url, params, locals, cookies }` — web standards plus small helpers.
- **Middleware.** `src/middleware.ts` exports `(ctx, next) => Response | Promise<Response>`.
- **Typegen.** `lumen typegen` runs automatically in dev and build, and emits `.lumen/types/` with typed route params, `RouteProps<"/blog/[slug]">` and a typed `href("/blog/[slug]", { slug })`. Agents get compile errors for broken links.
- **Server.**
  - The build produces `export default { fetch(request): Promise<Response> }`.
  - Adapters (`node`, `bun`, `deno`, `cloudflare`, `vercel`, `netlify`, `static`) wrap it.
  - Dev uses the Vite 8 Environment API (client + ssr environments).
- **Configuration.** `vite.config.ts` with `plugins: [lumen({ adapter, css: { targets }, viewTransitions, prefetch })]`. There is one config file, and it is standard Vite. The `lumen` CLI wraps Vite for `dev` / `build` / `preview` and adds `check`, `typegen`, `routes`, `docs`, `explain` and `mcp`.
- **Not in v1:** RPC server functions, a data-loader layer separate from async components, image optimisation (use the Vite ecosystem), i18n routing.

## 9. Tooling

| Concern | Approach |
|---|---|
| Type checking | Stock TS 7 `tsc` and native language service. No TS plugins (they don't load under TS 7). `lumen check` runs `tsc --noEmit` plus compiler diagnostics plus lint in one pass |
| Editor (VS Code) | Lumen extension: a TextMate **injection grammar** for `css` templates (re-entering TSX inside `${}`), an **LSP client** for `@lumen-jsx/language-server`, snippets, and a command palette (`Lumen: Explain diagnostic`, `Lumen: Show compiled output`) |
| Language server | Node, `vscode-languageserver` + `vscode-css-languageservice`. Finds `css` regions using the compiler's napi parser and builds whitespace-masked virtual CSS (`${}` replaced by same-length placeholders). Provides completion, hover, colors and CSS diagnostics, plus compiler diagnostics and execution-contract hovers. Works with any LSP editor (Neovim, Zed, Helix). Reassess when the TS 7.1 APIs land; there is no dependency on them |
| Lint | `eslint-plugin-lumen-jsx` (ESLint v9 API), loaded by oxlint `jsPlugins` (alpha) or ESLint. Rules cover what the compiler can't see cheaply: `no-unsafe-html`, `prefer-attach-over-ref-effects`, and so on. Disable React `className` rules |
| Format | oxfmt (verified to format `css` templates in TSX) or Prettier. The tag must stay named `css` |
| Test | Vitest, using the Vite plugin. `@lumen-jsx/testing` provides `render()` + Testing Library queries; Vitest browser mode for real-DOM tests; `renderToString` for SSR tests. Playwright only for a few e2e flows |
| Dev tools | Later: a browser devtools panel (signal graph, islands, owner tree). The execution-contract data comes from compiler `meta` |

## 10. Agent-first DX

Agents are a primary user of Lumen. Agent DX is designed and tested like the API.

1. **Small, familiar surface.** About 25 exports in `lumen-jsx` core. JSX that looks like React. CSS that is CSS. Names borrowed from the best-known APIs (Angular / Solid signals, Vue `provide` / `inject`, Astro `client:*`).
2. **Docs inside the package.** `node_modules/lumen-jsx/docs/**/*.md` always matches the installed version. `create-lumen-jsx` writes an `AGENTS.md` (and a `CLAUDE.md` that references it) telling agents to read local docs first. `lumen docs <topic>` prints them. The website also publishes `llms.txt` and `llms-full.txt`.
3. **Fixed doc pattern per concept:** concept → API → minimal example → "common mistakes", generated from the diagnostic catalogue → related diagnostics.
4. **Machine-legible diagnostics.**
   - Stable `LUMxxxx` codes with `help` and a fix.
   - `lumen explain LUM2001` prints the long-form explanation.
   - Every CLI command supports `--format json` and meaningful exit codes.
5. **MCP server (`lumen mcp`).**
   - Tools: `docs_search`, `docs_get`, `check` (diagnostics with fixes), `routes` (route table with modes), `components` (components, props, islands, styles from compiler `meta`), `compile` (show the compiled output for a file), `render` (SSR-render a route to HTML), `dev_logs`.
   - Resources: docs pages and the project's route manifest.
6. **Agent eval suite** (`benchmarks/agent-evals`).
   - A fixed set of tasks: scaffold an app, add a styled component, add an island, add a route with an action, fix a reactivity bug, and so on. Coding agents run them in CI on release candidates.
   - Metrics: first-attempt `lumen check` pass rate, task success, tokens used.
   - Regressions block releases, in the same way performance regressions do.
7. **Skill bundle.** `lumen-jsx/skills/lumen/SKILL.md` (agent-skill format), installed by `lumen agents init`, alongside the AGENTS.md snippet.
8. **Deterministic outputs.** Stable hashes, stable codegen and no timestamps, so agent diffs and snapshots stay reviewable.
9. **Codemods.** `lumen upgrade` applies version migrations, so breaking changes don't depend on agents relearning.

## 11. Performance model

### 11.1 The bar

js-framework-benchmark, Chrome 154, keyed. Published 2026-10-04 on an M4 MacBook Pro. Figures are the weighted geometric mean of CPU time relative to the fastest; lower is better.

| Framework | CPU | Run memory | Size (compressed) | First paint |
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

**Targets for Lumen:**
- CPU **≤ 1.12**, i.e. beat React by about 30% and match Solid, Vue Vapor and Marko.
- Run memory **≤ 2.6 MB**.
- Benchmark bundle **≤ 5 kB** compressed.
- First paint **≤ 60 ms**.

Beating React is the easy part: any compiled fine-grained renderer does it. The real competitors are Marko 6, Vue Vapor, Solid and ivi.

### 11.2 Why the design reaches it

| Benchmark operation | Cost driver | Lumen technique |
|---|---|---|
| create 1k / 10k rows, append | node creation, binding setup | `<template>` cloning, path walks, plain writes for static parts, row-closure hoisting with delegation data slots, zero-allocation links |
| replace all / clear | teardown + creation | owner disposal without per-node bookkeeping, `textContent = ""` fast path |
| partial update (every 10th row) | update propagation | push-pull flags; only the affected text bindings run (`effect(compute, apply)` with an equality check) |
| select row | per-row class updates | compiler-detected selector pattern turns this into `selector()`, so only 2 rows are touched (O(1)) |
| swap rows | list moves | prefix/suffix trimming + swap detection + LIS. React's forward-only moves cost 89.7 ms, 8.2× vanilla |
| remove row | list removal | fast path, owner disposal |
| memory | graph and closures | intrusive links, unlinking of unobserved computeds, no per-row closures for delegated events |
| startup and size | runtime bytes | ≤ 5 kB runtime; no VDOM, reconciler or synthetic event system |

**Versus React 19:**
- React re-runs component functions and diffs a virtual DOM.
- Its synthetic event system and reconciler cost about 50 kB and 220 ms of first paint.
- Its keyed moves are forward-only.

Lumen removes all three by design.

### 11.3 SSR and islands

- **SSR throughput.** Templates compile to string concatenation, escaping is fused into the generated code, and server components create no component instances or reactive graph.
  - This is the technique behind the fastest string renderers: Marko leads the eknkc ssr-benchmark, and Solid and Vue lead Platformatic's.
  - Lumen also avoids per-element hydration keys and their bytes. Only island subtrees carry markers.
- **Page weight.** Server-first islands make the default page JavaScript ≈ 0. Interactive pages pay for the loader (~1 kB), the runtime (≤ 5 kB) and island code.
  - React apps pay for full hydration plus RSC's double payload (the same props in the HTML and in the Flight data).
- **Measured, not just claimed.**
  - `benchmarks/js-framework-benchmark` keeps a keyed Lumen implementation, with CI comparisons against Solid, Svelte, Vue Vapor, Marko and React.
  - `benchmarks/ssr` runs a reproducible SSR throughput suite (2026 lacks a reputable cross-framework one), covering Lumen, Solid, Svelte, Vue, Marko and React.
  - A performance regression of more than 3% blocks release.

## 12. Compatibility matrix

| Tool | Status |
|---|---|
| TypeScript 7 (`tsc`, native LS) | ✅ no plugins; JSX via `jsxImportSource` |
| TypeScript 6 | ✅ same types |
| Vite 8 / Rolldown | ✅ `lumen-jsx/vite` (JS plugin calling napi) |
| Vitest | ✅ via the Vite plugin |
| oxlint / ESLint | ✅ plain TSX; `eslint-plugin-lumen-jsx` for both |
| oxfmt / Prettier | ✅ formats embedded `css` |
| Tailwind v4, PostCSS, CSS Modules | ✅ via the Vite CSS pipeline |
| Testing Library | ✅ via `@lumen-jsx/testing` |
| Web components | ✅ rendered as elements; `on:` for custom events. Exporting Lumen components as custom elements is a later item |
| npm packages | ✅ any ESM; browser-only libraries in `client:only` islands |
| React / Vue / Svelte components | ❌ v1. A React island adapter is a candidate later |
| Storybook / storylite | ⏳ later: needs a Lumen renderer |
| Deploy targets | ✅ via adapters over a `fetch` handler |

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| OXC pre-1.0 API churn | Upgrade cost | Exact pins, golden fixtures, pure core crate, the Vize / dom-expressions pinning playbook |
| No in-core Rolldown plugin | Some transform overhead | Rust-side hook filters, one pass per file, track raw AST transfer |
| TS 7.0 has no API | No type-aware checks (island prop serializability) | Runtime dev checks plus best-effort static checks; reassess after TS 7.1 (Nov 2026) |
| Compiled idioms (`.map`, destructured props) differ from plain JS semantics | Surprises | Narrow, documented patterns; diagnostics when a pattern escapes; "show compiled output" in the LSP and MCP |
| Signal-read footguns of the setup-once model | Silent staleness | `LUM2001`–`LUM2004` plus agent evals |
| oxlint JS plugins are alpha | Lint gaps | ESLint stays supported |
| Lightning CSS crate is still versioned "alpha" | Upgrade cost | Pin it (as Vize does) |
| Name collisions (`lumen` taken on npm and crates; Laravel Lumen) | Discoverability and confusion | `lumen-jsx` everywhere; final naming is a user decision (§14) |
| Crowded positioning: TSRX (adopted by Solid 2), Ripple and Octane offer "TSX + `<style>`" | Weak differentiation | Lead with "valid TSX, zero new tooling", reactive CSS, server-first islands and agent evals. A TSRX frontend could be added later if it wins adoption |
| Strict CSP blocks SSR `style` attributes | Broken reactive CSS for CSP users | `csp: "strict"` mode (§7.4.1) |
| Marko 6 / Vue Vapor already at about 1.10 CPU | "Faster" claim at risk | Benchmark in CI from milestone M1; selector and delegation optimisations; a ≤ 5 kB budget |
| Islands mixed with SPA subtrees cause edge cases (cf. Vue's Vapor/VDOM interop) | Bugs at boundaries | SPA = one root island, so a single hydration protocol. Frames come later, keeping island state across swaps (Remix precedent) |
| Scope of a full meta-framework | Schedule | Phase it: core + compiler first, then SSR/islands, then the app layer (TASK-4 roadmap) |

## 14. Open questions for the user

1. **Name and npm scope.** `lumen`, `create-lumen` and the `lumen-compiler` crate are taken. The proposal is to keep the brand "Lumen" with the packages `lumen-jsx`, `@lumen-jsx/*`, `create-lumen-jsx`, and the crates `lumen_jsx_*`. Alternatively, pick a new brand now, before any code exists.
2. **Data layer.** The proposal is async server components plus endpoints plus form actions, with no separate `load()` loader in v1. Would you prefer a Remix-style route `loader` as the single data API across all modes?
3. **Signal read syntax.** `count()`, as in Solid and Angular (proposed), or `count.value`, as in Vue and Preact?
4. **Event naming.** `onClick` delegated plus `on:click` native (proposed, Solid-style), or a Remix 3-style `on()` mixin API?
5. **React island adapter.** Should it be planned for v1.x, so that React component libraries can be used inside islands?

## 15. Decision index

| Id | Title | Status |
|---|---|---|
| decision-1 | Author components as valid TSX files | accepted |
| decision-2 | Scoped component styles via `<style>` with reactive CSS variables and a global attribute | accepted |
| decision-3 | Setup-once components with fine-grained signals and no virtual DOM | accepted |
| decision-4 | Server-first rendering with islands and per-route SPA mode | accepted |
| decision-5 | Rust compiler on OXC + Lightning CSS, shipped as napi-rs + a Vite/Rolldown plugin | proposed |
| decision-6 | TypeScript 7 policy: no TS plugins; editor features via TextMate injection + Lumen LSP | proposed |
| decision-7 | Compiler-recognised JSX idioms and reactive props destructuring | proposed |
| decision-8 | Reactive core on the alien-signals algorithm: sync reads, batched effects | proposed |
| decision-9 | Island protocol: `client:*` at the usage site, comment markers, data-only serialization | proposed |
| decision-10 | Agent-first DX contract | proposed |

## 16. Research references

- **TASK-1:** framework runtimes, rendering models and benchmarks (Prism), in its implementation notes. Key sources:
  - js-framework-benchmark, Chrome 154: https://krausest.github.io/js-framework-benchmark/2026/chrome154.html
  - alien-signals: https://github.com/stackblitz/alien-signals
  - Solid 2 RC: https://github.com/solidjs/solid/discussions/2995
  - Vue Vapor: https://github.com/vuejs/core/blob/minor/packages/runtime-vapor/src/apiCreateFor.ts
  - Remix 3 hydration: https://github.com/remix-run/remix/blob/main/packages/component/docs/hydration.md
  - Declarative partial updates: https://developer.chrome.com/blog/declarative-partial-updates
  - TSRX: https://tsrx.dev/
- **TASK-2:** Rust compiler toolchain and editor tooling (Photon), in its implementation notes. Key sources:
  - dom-expressions compiler: https://github.com/ryansolid/dom-expressions/tree/next/packages/compiler
  - Vize: https://github.com/ubugeeei/vize
  - Rolldown hook filters: https://rolldown.rs/apis/plugin-api/hook-filters
  - TS 7.1 plan: https://github.com/microsoft/TypeScript/issues/63703
  - VS Code embedded languages: https://code.visualstudio.com/api/language-extensions/embedded-languages
  - oxfmt embedded formatting: https://oxc.rs/docs/guide/usage/formatter/embedded-formatting
