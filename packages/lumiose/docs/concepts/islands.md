# Islands

> Pages ship no JavaScript by default: add a `client:*` directive to a component and only that island hydrates in the browser.

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
input, submits and key presses that happen before hydration are replayed. An island whose module
fails to load or whose hydration throws is logged with its module, and those events get their
default actions (a link still navigates, a form still submits); a module that failed to load is
loaded again on the next interaction ([details](../reference/dom.md#lumiosedomloader)). Islands work in `static`
and `server` pages; how they compare with Astro's is in
[Compared with Astro islands](rendering-modes.md#compared-with-astro-islands), and how a built page
gets per-reader parts through an island in
[Close to partial prerendering](rendering-modes.md#close-to-partial-prerendering).

**Early events cover the island's own elements.** A click, input, submit or key press whose target
is inside a server-rendered island that has not hydrated yet is held back, starts hydrating the
island at once (whatever its directive) and is dispatched again once it has, in the order the
events came: one that arrives after hydration but before the held ones are dispatched waits behind
them. Nothing else is replayed: a button outside the island that opens it (through a shared signal
or a custom event), a keyboard shortcut the island listens for on `document` or `window`, a scroll
or a pointer move find no listener before hydration, and are lost. For an island that such a trigger opens, a search
dialog opened from a header button or with Ctrl+K say, use `client:load`, or move the trigger inside
the island.

**Directives** (components only):

| Directive                                   | Hydrates                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `client:load`                               | Immediately.                                        |
| `client:idle`                               | When the browser is idle (at the latest after 2 s). |
| `client:visible` / `client:visible="200px"` | When it enters the viewport (optional root margin). |
| `client:media="(max-width: 600px)"`         | When the media query matches.                       |
| `client:only`                               | Client-rendered only: no server HTML.               |

**Props must be serializable**: JSON values plus `undefined`, `NaN`/`Infinity`, `BigInt`, `Date`,
`URL`, `Map`, `Set` and `FormData` (its text entries; files are left out). Functions, symbols, class instances (a `Response` too), promises and cycles
are `LUM4002`.

**Children and JSX props are slots.** They are rendered on the server and stay server components:
they never ship their own JS. A slot the island rendered on the server is adopted in place when it
hydrates; one it did not render yet (behind a condition) is sent as `<template data-l-slot="name">`
and inserted when the island renders it. A slot renders in the page, before the island runs, so it
does not see the context the island provides around it. The parts of a compound component
(`@lumiose/ui`'s `Combobox.Item`, `Tabs.Tab`, …) passed as a slot do not see the `Root` the
island renders, and the server throws "Combobox parts must be inside <Combobox.Root>". Pass the
data as a prop and render the parts inside the island:

```tsx
// Throws: the items render in the page, outside the island's <Combobox.Root>.
<CityPicker client:load options={cities.map((c) => <Combobox.Item value={c}>{c}</Combobox.Item>)} />

// Works: the island renders the items from a prop.
<CityPicker client:load cities={cities} />
```

**What hydration does.** The island's component runs again in the browser, with the props the
server serialized, and its compiled code claims the server's nodes instead of creating new ones:
the DOM, focus and text selections stay. Awaits replay the values recorded during SSR instead of
fetching again, while still tracking what they read, so a later change re-runs the component and
fetches. Everything outside islands stays server HTML that never hydrates. `client:only` renders on
the client without server HTML. An island inside a streamed `<Suspense>` waits for its content
before hydrating.

**Nested directives.** A `client:*` inside an island's own render is just a component: it is
already client-side.

**Context starts at the island.** An island hydrates as its own root, so context the page provided
outside it (a `<Ctx value>` provider in a layout or page) does not reach it, and the server renders it the same
way: `useContext()` inside an island returns the context's default, unless the island or a component
inside it provides the value. Contexts provided inside the island work on both sides. To hand page
data to an island, pass it as a prop; to share state between islands, use scoped state
(`defineState`, [Sharing state](state.md)): one instance per page, seeded on the server and sent
with the page. In dev, an island that reads a context the page provided warns
`LUM4010`. Slots are page content, so they keep seeing the page's context. `<Suspense>`,
`<ErrorBoundary>`, request APIs (`locals()`, `cookies()`, …) and `getAbortSignal()` work inside islands
during SSR as everywhere else.

**URL state: `searchParams`.** `searchParams()` from
[`lumiose/router`](../reference/router.md#searchparams) is the page's query, reactive, and every
island of the page sees the same value. `searchParams.set({ q })` loads the page with the new
query, so the server renders all of it again. To keep state in the query string without
reloading, pass `{ shallow: true }`: `set()` then changes the URL with `history.pushState()`
(`{ replace: true }` for `replaceState()`) and updates `searchParams()`, and back/forward between
those entries update it too. Nothing navigates then: the server-rendered parts of the page keep the
HTML of the URL they were rendered for, and the navigation hooks do not run. So the island owns
the query-dependent UI (a search box and its results table): the page passes the first results as
props, and the island fetches the next ones from an endpoint. A reload, or a shared link, renders
the new query on the server. During SSR, islands of `server` pages read the request's query; a
`static` page has none at build time (`LUM5001`), so its island reads it with `client:only`, or in
`onMount()`. `params()`, `route()` and `url()` work only inside `spa` routes: pass them as props.

**Server-only boundaries.** `*.server.ts` files and everything under `src/server/` may not be
imported from code that reaches the browser (`LUM4003`): keep database access, secrets and
`env()` there. `lumiose dev` and `lumiose build` fail with the chain of importers when the client graph
reaches one, and `lumiose check` reports the import. Server-only APIs (`request()`, `cookies()`,
`env()`, …) throw `LUM4003` in the browser build.

**Awaited data** inside an island is recorded during SSR and replayed during hydration, so the
browser does not fetch it again; it must be plain data (`LUM4007`), and it is visible in the page
source. Cached awaits (`fetchJSON`, `query`) are sent once per page however many islands await
them, and fill the browser cache, so later awaits and `invalidate(url)` start from them. So are the values of scoped state that islands import (`defineState`, `LUM4011`): the page
sends them once, before the islands that read them hydrate. The loader and `hydrate()` are described in [`lumiose/dom`](../reference/dom.md).

**The loader script.** `lumiose dev` and `lumiose build` add the loader to every page that renders an
island, once, as `<script type="module" async>`: in the `<head>` when the shell has islands,
otherwise with the first streamed chunk that does. In a build, pages without islands load no
JavaScript; the loader is the client entry, and each island is a chunk it imports when the island's
trigger fires. The loader's chunk also holds the Lumiose runtime the islands share (signals, DOM,
hydration), so a page loads one runtime file before its islands: about 8 to 10 kB min+brotli in
the sample apps (`pnpm --filter lumiose size:apps` reports them; `pnpm --filter lumiose size` checks
the 10 kB cap on what an islands page ships and the 15 kB cap on the whole client runtime). With your own server, pass its URL as
`renderToStream(root, { loaderUrl })`.

**Code before hydration: `src/instrumentation.client.ts`.** The place for what must run in the
browser before any island hydrates: an error-reporting or analytics SDK, a polyfill, global
listeners. The file is optional (`.ts`, `.js` or `.mjs`), and Lumiose loads it once per document
load on every page the app serves, as the first `<script type="module">` of the head (in a build,
with `<link rel="modulepreload">` for the chunks it imports):

- **Before hydration.** Its top-level code completes, top-level `await` included, before any
  island hydrates and before the SPA router starts (prerendered SPA pages and `ssr = false` shells
  included). Meanwhile the loader already captures clicks, input and submits on islands, and
  replays them once the islands hydrated. Client navigations of an SPA do not run it again.
- **Pages without islands or SPA routes** load it and its imports as their only scripts, without
  the Lumiose runtime, also when it uses `import()`.
- **Failures.** What it throws is logged, and the page hydrates anyway.
- **Keep it short.** `lumiose dev` warns when it takes longer than 16 ms (one frame) from the
  start of its module to the end of its top-level code; `import()` what is not needed at once.
- **Client code.** It is bundled like an island: only `PUBLIC_*` env reaches it, and importing
  server-only code is `LUM4003`. An edit reloads the page in `lumiose dev`. With
  `lumiose({ csp: "strict" })` its tags carry the nonce like the loader's.

**Errors and tracing: `onError` and `instrumentations`.** Two optional exports of the file
receive what happens in the browser, as `src/instrumentation.server.ts` does on the server:

```ts check file=instrumentation.client.ts
// src/instrumentation.client.ts
import type { ClientErrorInfo, ClientInstrumentation } from "lumiose";

export function onError(error: unknown, info: ClientErrorInfo) {
  console.info("report", error, info.phase, info.route, info.island);
}

export const instrumentations: ClientInstrumentation[] = [
  {
    navigate: async (call, info) => {
      const start = performance.now();
      const result = await call();
      console.info(`${info.to?.route}: ${result.status} in ${performance.now() - start} ms`);
    },
    hydrate: async (call, info) => {
      performance.mark(`hydrate ${info.island}`);
      await call();
    },
  },
];
```

- **`onError(error, info)`** receives errors of islands, `"hydrate"` (the island's module did not
  load, its hydration threw, or an event caught before it hydrated could not be dispatched
  again), `"render"` (an async component, or what an `<ErrorBoundary>`
  caught) and `"effect"` (an effect or binding after hydration), of the SPA router, `"navigate"`
  (a page that throws or whose module does not load), and of `submit()`, `"submit"` (a rejection;
  not an abort). `info` is `{ phase, route, island }`: the SPA route (undefined on MPA pages) and
  the island's `module#export`. Errors keep reaching the console as before.
- **`instrumentations`** wrap `navigate` (`{ type, from, to }`, until the page is on screen),
  `submit` (`{ action, url }`), `fetch` (each `fetchJSON()` request, `{ url }`, or `query()`
  function, `{ key }`) and `hydrate` (each island, `{ island }`), each with the current `route`.
  The rules are the server's: call `call()` where the phase runs and await it to time it; it never
  throws and resolves to `{ status: "success" }` or `{ status: "error", error }`. A wrapper only
  observes, what it or `onError` throws is logged, and the first observer is the outermost.
- **Cost.** They are read before the first island hydrates, so its hydration is observed too.
  Apps without the file ship none of this code: `lumiose build` turns the runtime's calls on only
  for apps that have it (about 0.7 kB brotli with islands, the router, actions and `fetchJSON`).

`src/instrumentation.server.ts` is its server counterpart ([Server](server.md#instrumentation)).
Types: [`lumiose`](../reference/app.md#instrumentation-types).

**Scripts of server-rendered components: `?client`.** A component that renders on the server and
needs a small script in the browser, without becoming an island (the definition of a custom
element it renders, an enhancement of native HTML, a theme toggle), imports the script with the
`?client` query and calls the import while it renders:

```ts check file=components/copy-button.ts
// src/components/copy-button.ts: runs in the browser only
customElements.define(
  "copy-button",
  class extends HTMLElement {
    connectedCallback(): void {
      // The server's data, from the attribute the component wrote.
      const text = this.getAttribute("text") ?? "";
      // On the element itself: clicks bubble from the button, which the parser may add later.
      this.addEventListener("click", () => {
        void navigator.clipboard.writeText(text);
      });
    }
  },
);
```

```stsx check file=components/CopyButton.stsx
// src/components/CopyButton.stsx
import defineCopyButton from "./copy-button.ts?client";

// Types the attributes the server writes and the script reads.
declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "copy-button": JSX.HTMLProps<HTMLElement> & { text: string };
    }
  }
}

export function CopyButton(props: { text: string }) {
  defineCopyButton();
  return (
    <copy-button text={props.text}>
      <button type="button">Copy</button>
    </copy-button>
  );
}
```

- **Only on the pages that render it.** A page whose render calls the import gets one
  `<script type="module" async>` for the script, with `<link rel="modulepreload">` for its imports,
  in the `<head>`, or with the streamed chunk of the `<Suspense>` boundary that rendered it.
  Without the island runtime: a page with no islands loads the script and nothing else. Pages that
  import the component without rendering it load nothing.
- **Never on the server.** The script is not imported on the server, so it may use
  `customElements`, `document` and `window` at its top level.
- **Server data goes through attributes.** The call takes no arguments. The component writes its
  data as attributes of the element it renders, and the script reads them in `connectedCallback`.
  Declare the element in `JSX.IntrinsicElements`, as above, so the server side is type-checked
  ([Web components](../guides/web-components.md#server-data-in-attributes)). Each instance carries
  its own data, and custom elements upgrade wherever they appear: streamed boundaries, SPA
  navigations, Markdown or CMS HTML. Attribute values are strings, so the script parses numbers,
  booleans and JSON itself.
- **It can run before the children exist.** The script is async, so on a slow or streamed
  response, or from the cache, it can define an element before the parser has added the
  element's children: `connectedCallback` then runs with the attributes but no children. Listen on
  the element itself, as `copy-button` does (events from later children bubble to it), and while
  `document.readyState` is `"loading"`, wait for `DOMContentLoaded` before reading or replacing
  the children.
- **Elements the script creates are unscoped**: the component's scoped styles do not reach them.
  Render them on the server, or style them with `:deep()` under an element of the scope
  ([Web components](../guides/web-components.md#before-the-children-are-parsed)).
- **Islands and SPA pages** import the script with their own code, before the component runs, and
  the call does nothing there: a page that gets it both ways runs it once.
- **Keep it free of the runtime.** A script that imports `lumiose` makes its pages load the
  runtime. It is client code: only `PUBLIC_*` env reaches it, and importing server-only code is
  `LUM4003`.
- **Builds** find `?client` imports in the project and its
  [Lumiose packages](../reference/vite.md#lumiose-packages), linked or installed from npm, and build
  each script as a chunk of its own. An import they do not find, such as one in a package that
  does not depend on `lumiose` or a module outside the project, is a build warning, and its pages
  do not load it: the first page that renders its component, while prerendering or on the server,
  warns which script it goes without. In `lumiose dev`
  the script loads from its own URL. Its type comes from `lumiose/env`: a default export
  `() => void`.
- **`.html` imports** load their `<script>` elements the same way
  ([Markdown and HTML imports](content.md)): a page that renders one, and no island, loads its
  scripts and no island runtime.

**Build output.** `lumiose build` puts the Lumiose runtime in one chunk: the island loader's, the SPA
entry's when the app has no islands, or a shared `lumiose-[hash].js` when it has both. The router's
History API fallback is a separate chunk, loaded only by browsers without the Navigation API.

Which runtime goes where follows one rule: the runtime chunk holds what the loader (or the SPA
entry) imports, plus the runtime that two or more islands (or SPA pages) import; runtime that only
one island imports goes into that island's chunk. A page's JavaScript then depends on its own
islands, not on every island of the app: the keyed selector the compiler emits for one island's
list, or `submit()` used by one form island, loads only on the pages that render that island. The trade-off: runtime shared
by several islands stays in the runtime chunk, so a page with none of them still loads it, but no
page loads more files than it has islands (a chunk per group of islands would cost one more request
each). Imports through `lumiose` and `lumiose/dom` count only the modules that declare what they
import. `fetchJSON` follows the same rule. One exception stays in the runtime chunk: a few bytes
that guard `fetchJSON`'s cache, so the minifier can drop the cache in apps without async components
or resources, which it can only do within one chunk.

Dynamic imports go through a smaller preload helper than Vite's: it still adds the imported chunk's
stylesheets (and waits for them, skipping those the page already holds in its merged or inline
styles), module preloads and the CSP nonce of `<meta property="csp-nonce">`, but dispatches no `vite:preloadError` event (the router loads the
URL with a document navigation when a page's module does not load).

**Islands from other packages.** Components of a
[Lumiose package](../reference/vite.md#lumiose-packages), linked (`"@acme/ui": "workspace:*"`) or
installed from npm, can be or render islands too. Island records name modules without
build-machine paths: root-relative inside the project
(`/src/components/LikeButton.stsx#LikeButton`), package-relative in a package
(`@acme/ui/src/Nav.stsx#Nav`, also for one installed under the project's `node_modules`), or by
the import's bare name (`import { Nav } from "@acme/ui"` gives `@acme/ui#Nav`). Either way, the
`modulepreload` hint of a `client:load` island points at its chunk in a build and at Vite's URL of
the module in dev. Builds also look for island call sites in the Lumiose packages, so each of
their islands gets its chunk even when only server code renders it. Folders inside a linked
package that are projects of their own (with a `package.json`, `tsconfig.json` or
`vite.config.*`, such as a showcase app) are left out.

> **Status:** available: island calls and records (`LUM4001`, `LUM4002`), the loader with its
> triggers and event replay, and hydration (`LUM4006` on a mismatch), in `lumiose dev` and builds.

## API

| API                                                                                     | Use                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `client:load`, `client:idle`, `client:visible`, `client:media`, `client:only`           | Make a component instance an island.                                             |
| `export function X`                                                                     | Islands must be exported, so the browser can import them (`LUM4001`).            |
| `*.server.ts`, `src/server/**`                                                          | Server-only modules.                                                             |
| `import.meta.env.PUBLIC_*`                                                              | Env values that may reach islands.                                               |
| `src/instrumentation.client.ts`                                                         | Runs once per page load, before islands hydrate and the SPA starts.              |
| `onError`, `instrumentations` exports of it; `ClientErrorInfo`, `ClientInstrumentation` | Report browser errors; observe hydration, navigations, submissions and requests. |
| `import x from "./script.ts?client"`, `x()` while rendering                             | Load a browser script on the pages that render a component, without islands.     |

## Example

```stsx check file=components/LikeButton.stsx
// src/components/LikeButton.stsx: an island; exported so the browser can import it
import { signal } from "lumiose";

export function LikeButton({ initial, children }: { initial: number; children?: JSX.Element }) {
  const likes = signal(initial);

  return (
    <button class="like" onClick={() => likes.update((n) => n + 1)}>
      {children} {likes()}
    </button>
  );
}

<style>
  .like { border-radius: 999px; }
</style>
```

```stsx check file=routes/posts/[id]/page.stsx
// src/routes/posts/[id]/page.stsx: a server component; only LikeButton ships JS
import { params } from "lumiose";
import { LikeButton } from "../../../components/LikeButton.stsx";

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
- **Reading page context inside an island.** An island hydrates as its own root, so it does not
  see values the page provided outside it with a `<Ctx value>` provider, and it renders the same way on the
  server: `useContext()` returns the context's default unless the island (or a component inside it)
  provides the value. Pass the value as a prop, or share scoped state (`defineState`,
  [Sharing state](state.md)); dev warns with `LUM4010` when the page did provide it.
- **Different output on server and client**, for example from `Math.random()` or `Date.now()` in
  render. Hydration reports `LUM4006` in dev and client-renders the range in production.
- **Expecting `submit()` to refresh the page.** On MPA pages a successful `submit()` does not
  reload: the island owns its state and updates itself from the result. Call `invalidate()` when
  the page needs fresh server HTML ([Data and actions](data-and-actions.md)).
- **Starting an SDK inside an island.** It runs only where that island renders, and after other
  islands may have hydrated. Start it in `src/instrumentation.client.ts`, which every page runs
  first.
- **Making a whole page an island to get interactivity.** Mark only the interactive parts, or use
  an `spa` route ([Choosing a mode](rendering-modes.md#choosing-a-mode)).
- **Rendering query-dependent HTML on the server and changing the query shallowly.**
  `searchParams.set(next, { shallow: true })` does not re-render the page, so a table the server
  rendered from `url().searchParams` keeps the old rows. Drop `shallow` to load the page, or render
  that table inside the island, from props and an endpoint.

## Related diagnostics

- [LUM4001](../errors/LUM4001.md): island component is not exported.
- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4004](../errors/LUM4004.md): browser API at module scope.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.
- [LUM4010](../errors/LUM4010.md): island reads context provided by the page.
- [LUM4011](../errors/LUM4011.md): non-serializable scoped state value.

See also: [Rendering modes](rendering-modes.md), [Async components](async.md), [Sharing state](state.md) (state shared by islands).
