---
id: doc-8
title: M10 extension points API proposal
type: specification
created_date: '2026-10-15 02:39'
updated_date: '2026-10-15 02:39'
---
# M10 extension points: API proposal

Status (2026-10-15): **proposal**, waiting for the user's review (TASK-293). Nothing here is decided. Each approved item becomes a decision and updates its implementation task; rejected items close theirs.

Abbreviations: RR = React Router 7, NX = Next.js 16, SK = SvelteKit 2, SR = Solid Router, AS = Astro 5, TQ = TanStack Query 5.

## What you are asked to approve

| #   | Feature                | Proposed API                                                                           | Task     |
| --- | ---------------------- | -------------------------------------------------------------------------------------- | -------- |
| 1   | Folder middleware      | `middleware.ts` in route folders, and `ctx.route` in every middleware                  | TASK-294 |
| 2   | Client entry           | `src/instrumentation-client.ts`, run before hydration on every page                    | TASK-295 |
| 3   | Router hooks           | `beforeNavigate(fn)` and `afterNavigate(fn)` from `lumiose/router`                     | TASK-296 |
| 4   | Submissions            | `submission<typeof actions.x>()`: `{ submit, isSubmitting, result, error, abort, reset }` | TASK-297 |
| 5   | Server instrumentation | `src/instrumentation.ts`: `register`, `onRequestError`, `instrumentations`             | TASK-298 |
| 6   | Client instrumentation | `onError` and `instrumentations` exports of `src/instrumentation-client.ts`            | TASK-299 |
| 7   | Dev handler            | `createDevHandler()` from `@lumiose/vite/dev`                                          | TASK-300 |

Each section ends with the questions for you; the recommended answer comes first.

## Shared rules

- **Project files** sit in `src/` next to `document.stsx` and `middleware.ts`. Their names follow NX where the behaviour matches (decision-32, decision-42): `instrumentation.ts` and `instrumentation-client.ts` do what NX's files do.
- **Component-scoped hooks** (`beforeNavigate`, `afterNavigate`, `submission`) are called during component setup, like `onMount`, and are removed or aborted when the component is disposed.
- **Instrumentation observes and never changes behaviour** (RR's model). A wrapper receives `call`, which never throws and resolves to `{ status: "success" }` or `{ status: "error", error }`; it cannot change arguments or results, and an error thrown by a wrapper is logged without affecting the request.
- **Unused means free.** Without the file or the hook, no code ships to the browser and the server path adds at most one branch per phase, verified with an in-process A/B.
- **Names:** known names where the behaviour matches; no `use` prefix on coined names (decision-35).

## 1. Folder middleware and `ctx.route`

**Problem.** `src/middleware.ts` is the only middleware and runs for every request. Scoping it means comparing `ctx.url.pathname` strings: routes are matched before middleware runs and `ctx.params` is filled, but the matched pattern is only reachable through the `route()` getter, and `Middleware` takes no pattern to type it. A layout guard (`locals()` plus `redirect()`) covers the pages of its folder but not their form actions or the `route.ts` endpoints there, so a section such as `/admin` has no safe place for its auth.

**Proposal.**

```ts
// src/routes/admin/middleware.ts: every page, action and endpoint under /admin
import type { Middleware } from "lumiose";

const requireAdmin: Middleware<"/admin"> = async (ctx, next) => {
  if (!ctx.locals.user?.admin) return Response.redirect(new URL("/login", ctx.url), 303);
  return next();
};

export default requireAdmin;
```

- **Scope.** A `middleware.ts` (default export: a function or an array, like `src/middleware.ts`) runs for every request that matches a page, form action or endpoint in its folder or below. Group folders count: `(account)/middleware.ts` protects every route in the group without adding a URL segment.
- **Order.** As today, the trailing-slash redirect and the Origin check answer before any middleware. Then `src/middleware.ts`, and inside its `next()` the route's locale checks, the folder middleware from the outermost folder to the innermost, and the handler; responses unwind in reverse. URLs that match no route run `src/middleware.ts` only. An error thrown in middleware renders the error page outside the chain, as today.
- **`ctx.route`** is the matched pattern (`"/admin/users/[id]"`): the value `route()` already returns in middleware, now on `ctx` next to `ctx.params`, and `undefined` in `src/middleware.ts` for unmatched URLs. `Middleware` becomes generic: `Middleware<"/admin">` types `ctx.params` with the folder's params (the scope `LayoutProps<"/admin">` uses) and `ctx.route` with the patterns below the folder.
- **Locales.** `/es/admin` runs the `/admin` middleware; `ctx.locale` is set as today.
- **Static and prerendered routes.** Folder middleware runs whenever the app handles a route, the same rule `src/middleware.ts` follows today: per request for server routes and SPA documents, in dev for every route, and at build time for prerendered pages, whose files production then serves without the app. That suits headers and the `locals` a render reads, not auth, so a folder middleware that covers a prerendered route is a warning (a new LUM5xxx) in `lumiose check` and the build.
- **SPA routes.** Client navigations between `spa` pages do not reach the server. Folder middleware runs for the document request and for the actions and endpoints under the folder, which is what protects an SPA's data; the docs say so.
- **`lumiose routes`** prints each route's middleware chain.
- **Implementation.** The route scanner learns the `middleware` file kind, and the manifest gives each page and endpoint a `middleware` list, built like its `layouts` (outermost first).

**Cost.** Server only: zero browser bytes. Chains are resolved per route when the manifest is built.

**Alternatives.**
- *`export const middleware` from layouts and pages* (RR's route-module export). Rejected: layouts and pages of `spa` routes are client modules, so server-only code there is LUM4003 or leaks. A separate server-only file keeps the boundary.
- *Matchers in `src/middleware.ts`* (`when("/admin/**", mw)`, AS's `sequence`). No new convention, but scoping lives away from the routes and a new folder is easy to forget. `ctx.route` alone makes this possible in user code.
- *Named middleware listed per page* (Nuxt `definePageMeta`). Opt-in per page is how auth gets forgotten.

**Prior art.** RR: `middleware` and `clientMiddleware` route exports, parent to child. NX: one root `middleware.ts` (`proxy.ts` since 16). SK: one `handle` hook. AS: one `src/middleware.ts` with `sequence`. Nuxt: route middleware plus server middleware.

**Questions.**
1. The file name `middleware.ts` in route folders.
2. `ctx.route` as the name of the matched pattern.
3. `src/routes/middleware.ts`: **a LUM5002 error pointing to `src/middleware.ts`**, keeping one global place, or allowed as "every matched route".
4. Middleware covering prerendered routes: **a warning** (it runs at build time only), or an error.

## 2. Client entry: `src/instrumentation-client.ts`

**Problem.** Nothing runs before islands hydrate or the SPA router starts: analytics, error-reporting SDKs, polyfills, global listeners. The island loader and the SPA entry are generated; `src/document.stsx` only renders HTML.

**Proposal.**

```ts
// src/instrumentation-client.ts
import * as Sentry from "@sentry/browser";

Sentry.init({ dsn: import.meta.env.PUBLIC_SENTRY_DSN });
```

- **When.** Once per document load, before any island hydrates and before the SPA router starts: the generated island loader and SPA entry import it before they start, and the page preloads it so it adds no request waterfall. Its top-level code completes first, top-level `await` included. NX awaits only synchronous code; awaiting lets a polyfill load conditionally. The loader already captures and replays clicks and input that arrive before an island hydrates, so the wait loses no input. Dev warns when it takes longer than 16 ms (NX's budget).
- **Where.** Every page the app serves, including pages that ship no module script today (no islands, no SPA): they get one, with this file and its imports and without the Lumiose runtime. Creating the file is the opt-in. This also gives sites a global script without the island runtime (part of TASK-283).
- **Bundling.** Client code: server-only imports are LUM4003, and only `PUBLIC_*` env reaches it. Strict CSP nonces and hashes cover its script tag.
- **Failure.** A throw or rejection is logged and hydration continues.
- **Dev.** An edit reloads the page.
- It also hosts the client hooks of feature 6.

**Cost.** None without the file. With it: its own bytes, plus about 0.1 kB of loader code to import it.

**Alternatives.**
- *RR's `entry.client.tsx`, owning hydration.* Rejected: there is no single root to hydrate (islands hydrate one by one, the SPA boot is internal), and the file would freeze those internals as public API that every app copies.
- *Other names:* `src/client.ts` (short, but does not say when it runs) or `src/hooks.client.ts` (SK).
- *A config option* (`lumiose({ client: "./src/setup.ts" })`). Less discoverable than a file convention.
- *Only on pages that already ship JavaScript.* Cheaper for zero-JS pages, but analytics and error reporting would miss them.

**Prior art.** NX `instrumentation-client.ts` (before hydration, sync code only, `onRouterTransitionStart`). SK `hooks.client.ts` (`init`, `handleError`). RR `entry.client.tsx`.

**Questions.**
1. The name: **`src/instrumentation-client.ts`**, `src/client.ts`, or `src/hooks.client.ts`.
2. Pages: **every page**, or only pages that already ship JavaScript.
3. Top-level `await`: **awaited before hydration**, or not awaited (NX).

## 3. Router hooks: `beforeNavigate` and `afterNavigate`

**Problem.** `lumiose/router` can navigate and report state, but nothing runs around a navigation: no way to confirm leaving unsaved changes, cancel a navigation, record a page view or move focus afterwards.

**Proposal.**

```tsx
import { signal } from "lumiose";
import { afterNavigate, beforeNavigate } from "lumiose/router";

export function Editor() {
  const dirty = signal(false);

  beforeNavigate((navigation) => {
    if (!dirty()) return;
    if (navigation.willUnload) navigation.cancel(); // the browser asks
    else if (!confirm("Discard your changes?")) navigation.cancel();
  });

  afterNavigate((navigation) => analytics.page(navigation.to.url));

  return <textarea onInput={() => dirty.set(true)} />;
}
```

- **Lifecycle.** Called during component setup; removed when the component is disposed.
- **The navigation object.** `{ type, from, to, willUnload, cancel() }`, where `from` and `to` are `{ url, route, params }`; `to` is `null` when the next document is outside the app. `type` is `"link"`, `"navigate"` (`navigate()` and `searchParams.set()`), `"popstate"`, `"leave"` (another document or closing the tab) or, for `afterNavigate` only, `"enter"`.
- **`beforeNavigate`** runs before the router loads the next page: in the Navigation API's `navigate` event the router already intercepts, and before the History fallback changes the URL. `cancel()` stops it. Browsers let only some back/forward navigations be cancelled; for the others the router returns to the entry it left (the History fallback must start storing an entry index in `history.state` for that; it stores only a scroll key today). For `"leave"` and links outside the SPA, `cancel()` makes the browser show its own prompt (`beforeunload`); custom dialogs cannot run there.
- **`afterNavigate`** runs after the swap, scroll restoration and focus reset (after the View Transition's DOM update, not after its animation), and once when the component mounts with `type: "enter"`, so a page view is counted on the first load too.
- **MPA pages** have no router. In their islands, `beforeNavigate` sees only `"leave"`, and `afterNavigate` fires once with `"enter"`; no router code is loaded for them.

**Cost.** About 0.3 kB brotli in the router chunk; islands on MPA pages that use them pay for a small `beforeunload` helper only.

**Alternatives.**
- *RR `useBlocker`*, a blocker state with `proceed()` and `reset()` that suits async custom dialogs. The callback form fits setup-once components; a `retry()` on the cancelled navigation can come later if custom dialogs need it.
- *SR `useBeforeLeave`* (`preventDefault()`, `retry()`). Same idea; decision-35 keeps `use` off names whose behaviour is not React's.
- *Global guards registered once* (Vue Router `beforeEach`). App-wide observation is feature 6; cancelling belongs to the component that has unsaved state.

**Prior art.** SK `beforeNavigate`, `afterNavigate` and `onNavigate` (the same names and semantics). RR `useBlocker`. SR `useBeforeLeave`. NX `onRouterTransitionStart` (observe only).

**Questions.**
1. The names: **SK's `beforeNavigate` and `afterNavigate`**.
2. `afterNavigate` on mount: **fires once with `"enter"`** (SK), or only after navigations.
3. The `type` values above, with **`"navigate"`** where SK says `"goto"`.

## 4. Per-instance submissions: `submission()`

**Problem.** `submit()` posts without navigating, but the state is page-wide: `isSubmitting(name)` is keyed by action name and `actionData()` holds the last result of the page. Rows that submit the same action share one pending flag and overwrite each other's results.

**Proposal.**

```stsx
import { submission } from "lumiose";
import type { actions } from "./page.stsx";

export function TodoRow(props: { todo: { id: string; done: boolean } }) {
  const toggle = submission<typeof actions.toggle>();
  const failure = () => {
    const result = toggle.result();
    return result?.type === "failure" ? result.data.message : undefined;
  };

  return (
    <form method="post" action="?/toggle" onSubmit={toggle.submit}>
      <input type="hidden" name="id" value={props.todo.id} />
      <button disabled={toggle.isSubmitting()}>{props.todo.done ? "Undo" : "Done"}</button>
      <p class="error">{failure()}</p>
    </form>
  );
}
```

- **`submit(target, options?)`** takes what `submit()` takes and returns the same promise.
- **`isSubmitting()`**: this instance's request is in flight.
- **`result()`**: the last settled `{ type: "success" | "failure", status, data }`, typed from the action; `undefined` before the first one.
- **`error()`**: the last unexpected error (a `FetchError`), else `undefined`.
- **`abort()`** cancels the request in flight; **`reset()`** clears `result()` and `error()`.
- **Races.** A new submission on the same instance aborts the previous one (RR's fetcher behaviour). Disposing the component aborts too.
- **Page state.** An instance does not set `actionData()`, so rows never overwrite each other or the page's form; `isSubmitting(name)` still counts it. SPA invalidation and `optimistic()` work as with `submit()`: `likes.update((n) => n + 1, like.submit(event))`.
- **Implementation.** Built on `submit()`, which already takes a `signal`, with the instance's own `AbortController` and signals; `submit()` gains an internal option to leave `actionData()` alone.

**Cost.** About 0.3 kB brotli in the actions chunk, only for apps that use it.

**Alternatives.**
- *Filters on the existing APIs* (SR's `useSubmissions(action, filter)`): `isSubmitting("toggle", (input) => input.get("id") === id)`. No new object, but each row still needs its own result and abort.
- *Documentation only*: a local signal around `await submit()`. Every app rewrites the same code and gets races and aborts wrong.
- *TQ `useMutation`* through `@lumiose/query`. Works today in islands, at the cost of the TanStack runtime.
- *RR's name `fetcher()`*: RR's fetcher also loads data, which `fetchJSON` and `query` already do.

**Prior art.** RR `useFetcher` (per-instance state and data, `key` to share). SR `useSubmission` and `useSubmissions`. TQ `useMutation` (`isPending`, `data`, `error`, `reset`). SK `enhance` per form.

**Questions.**
1. The name: **`submission()`**, coined after SR's `useSubmission` without `use` (decision-35).
2. The members: **`submit`, `isSubmitting`, `result`, `error`, `abort`, `reset`**.
3. Instances leave `actionData()` alone: **yes**, or also set it.

## 5. Server instrumentation: `src/instrumentation.ts`

**Problem.** Error reporting is the build handler's `onError` option, which defaults to `console.error`. `@lumiose/adapter-node` and the Cloudflare, Vercel and Netlify adapters create the handler without options, so in production errors only reach the console; `lumiose dev` logs them to Vite and the overlay. Errors an `ErrorBoundary` catches are reported only outside dev. Tracing is limited to middleware wrapping `next()`, which does not see the phases inside a request.

**Proposal.**

```ts
// src/instrumentation.ts
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { RequestErrorInfo, ServerInstrumentation } from "lumiose";

export async function register() {
  // Once per server instance, before the first request: start an SDK here.
}

export function onRequestError(error: unknown, info: RequestErrorInfo) {
  report(error, { route: info.route, phase: info.phase, digest: info.digest });
}

const tracer = trace.getTracer("my-app");

const span = (name: string, attributes: Record<string, string>) =>
  (call: () => Promise<{ status: "success" | "error"; error?: unknown }>) =>
    tracer.startActiveSpan(name, { attributes }, async (s) => {
      const { error } = await call();
      if (error) s.setStatus({ code: SpanStatusCode.ERROR });
      s.end();
    });

export const instrumentations: ServerInstrumentation[] = [
  {
    request: (call, info) => span("request", { method: info.request.method })(call),
    action: (call, info) => span("action", { route: info.route, action: info.name })(call),
    render: (call, info) => span("render", { route: info.route })(call),
  },
];
```

- **Where it loads.** `lumiose dev`, `lumiose preview`, `dist/server/entry.js` (with `@lumiose/adapter-node`, Bun, Deno or your own server) and the deploy adapters. `register()` runs once per server instance (per isolate on workers) and is awaited before the first request.
- **`onRequestError(error, info)`** receives unexpected errors, in dev too: those masked as 500, errors in streamed boundaries, rejected `waitUntil()` work, and errors an `ErrorBoundary` caught (with their `digest`). `redirect()`, `notFound()` and `error(status)` are intentional and not reported. `info` is `{ request, route, params, phase, digest }`, with `phase` one of `"middleware"`, `"action"`, `"endpoint"`, `"render"`, `"stream"` or `"waitUntil"`. The handler's `onError` option stays for hosts, and `@lumiose/adapter-node` gains it too.
- **Prerendering** at build time does not load the file: errors there fail the build, as today.
- **`instrumentations`**, an array of observers with optional wrappers per phase: `request` (the whole app request; its result adds `status` and `route`), `middleware` (each middleware file, root or folder), `action` (with the action's name), `endpoint` (with the method), `render` (until the shell is ready) and `stream` (each streamed boundary). Static files are not instrumented: they are served before the app.
- **OpenTelemetry** is a docs example, not a dependency. Auto-instrumenting other Node libraries still needs `node --import`, as OpenTelemetry documents.

**Cost.** Without the file nothing loads. With it, one check per phase; the request path must not slow down in `pnpm --filter @lumiose/bench-ssr ab`.

**Alternatives.**
- *Middleware only* (today): sees the request, not its phases or streamed errors.
- *SK's `hooks.server.ts`* (`handle`, `handleError`, `init`). `handle` already exists as `src/middleware.ts`.
- *Built-in OpenTelemetry spans* (SK's experimental tracing; NX emits spans). Ties Lumiose to `@opentelemetry/api`; an official `@lumiose/otel` package could sit on this API later.
- *A Vite config option* (`lumiose({ onError })`). The config runs at build time, not in the server.

**Prior art.** RR `instrumentations` (`handler.request`; route `loader`, `action`, `middleware`; observe only; `call` never throws). NX `instrumentation.ts` (`register`, `onRequestError(error, request, context)`). SK `instrumentation.server.ts` and `handleError`.

**Questions.**
1. The file and exports: **`src/instrumentation.ts` with `register`, `onRequestError` and `instrumentations`** (NX plus RR names).
2. The phases: **`request`, `middleware`, `action`, `endpoint`, `render`, `stream`**.

## 6. Client instrumentation: exports of `src/instrumentation-client.ts`

**Problem.** Nothing reports SPA navigations, submissions, `fetchJSON` and `query` requests or island hydration. Errors reach the console at best: the router logs its own, and an island whose chunk fails to load or whose hydration throws ends in an unhandled promise rejection.

**Proposal.**

```ts
// src/instrumentation-client.ts
import type { ClientErrorInfo, ClientInstrumentation } from "lumiose";

export function onError(error: unknown, info: ClientErrorInfo) {
  report(error, { phase: info.phase, route: info.route, island: info.island });
}

export const instrumentations: ClientInstrumentation[] = [
  {
    navigate: async (call, info) => {
      performance.mark(`nav:${info.to.url}`);
      await call();
      performance.measure(`nav:${info.to.url}`, `nav:${info.to.url}`);
    },
  },
];
```

- **`onError(error, info)`** receives errors in islands (`"hydrate"`: loading the chunk or hydrating; `"render"`: async components and errors an `ErrorBoundary` caught; `"effect"`), router errors (`"navigate"`) and `submit()` rejections (`"submit"`).
- **`instrumentations`** wrap `navigate` (`{ from, to, type }`), `submit` (`{ action, url }`), `fetch` (`fetchJSON` and `query`: `{ url }` or `{ key }`) and `hydrate` (each island: `{ island }`), with the shared observer rules.
- Both are read from the client entry before hydration, so the first island's hydration is already observed.

**Cost.** Exports that do not exist cost nothing: the build drops the dispatch code. With them, about 0.3 to 0.5 kB brotli in the runtime.

**Alternatives.**
- *Window listeners* (`error`, `unhandledrejection`, today). They miss errors Lumiose catches and cannot time phases.
- *`afterNavigate` in a root layout* (feature 3). Fine for page views, not for timing or errors.
- *NX's `onRouterTransitionStart(url, type)`.* Start only; `navigate` covers start and end.

**Prior art.** RR client `instrumentations` (`router.navigate`, `router.fetch`, route `loader` and `action`). NX `onRouterTransitionStart`. SK `hooks.client.ts` `handleError`.

**Questions.**
1. The exports: **`onError` and `instrumentations`**.
2. The phases: **`navigate`, `submit`, `fetch`, `hydrate`**.

## 7. Dev handler: `createDevHandler()`

**Problem.** A custom server works only with the build. A project with its own Express, Hono or Node server keeps a second setup for `lumiose dev`, and WebSocket upgrades need a separate Vite plugin in dev (guides/realtime.md).

**Proposal.**

```ts
// server.ts: one server for dev and production
import { createServer } from "node:http";
import { createHandler } from "@lumiose/adapter-node";
import { handleUpgrade } from "./src/server/chat-socket.server.ts";

const server = createServer();
const handler =
  process.env.NODE_ENV === "production"
    ? await createHandler()
    : await (await import("@lumiose/vite/dev")).createDevHandler({ server });

server.on("request", handler);
server.on("upgrade", handleUpgrade); // returns false and leaves other upgrades (HMR) alone
server.listen(3000);
```

- **`createDevHandler(options?)`** starts Vite in middleware mode with the project's `vite.config.ts` and returns the same `NodeHandler` as `createHandler()` (a request listener or connect middleware), plus `close()`. `lumiose dev` always listens on its own port today; the `lumioseDev()` plugin it uses already mounts the app on Vite's middleware stack, so this is mostly wiring and tests.
- **Same as `lumiose dev`:** diagnostics overlay, HMR (its WebSocket on the given `server`), reloads after server-only edits, typegen.
- **In `@lumiose/vite/dev`**, next to `lumioseDev()`. `@lumiose/vite` is a dev dependency, so production never loads Vite.
- `lumiose dev` stays the default; this is for projects that own their server.

**Cost.** Dev only.

**Alternatives.**
- *NX's flag* (`next({ dev: true })`): `createHandler({ dev: true })` in `@lumiose/adapter-node`. One import, but the adapter would depend on Vite.
- *Lumiose hosts your server in dev* (`lumiose({ server: "./server.ts" })`, like `@hono/vite-dev-server`). The project loses control of its Node server in dev.
- *Documenting Vite's middleware mode by hand* (RR's custom-server template). Exposes internal virtual module ids.

**Prior art.** RR's custom server (Vite middleware mode plus `ssrLoadModule` of the server build). NX custom servers (`next({ dev })`). SK and AS: none in dev.

**Questions.**
1. **`createDevHandler()` from `@lumiose/vite/dev`**, or a `dev` flag on the adapter.

## Not proposed

- **Route loaders, `clientLoader` and `clientAction`.** Async components, `fetchJSON`, `query` and form actions cover them (decision-18).
- **Client middleware.** Feature 3 covers cancelling and feature 6 observing; nothing in Lumiose runs per navigation that middleware would wrap.
- **Routes defined in code.** File routes only (decision-42).

## Found while researching

- An island whose chunk fails to load or whose hydration throws ends in an unhandled promise rejection (`void load().then(…)` in `packages/lumiose/src/dom/islands.ts`, no catch), stays dead and keeps the events it captured. Recorded as its own task; feature 6 then reports these errors.
- Errors an `ErrorBoundary` catches on the server are reported only outside dev (feature 5 changes that).

## After approval

Each approved feature becomes one decision (its file names, exports and semantics), linked from its task; the task's description and acceptance criteria are updated to the approved shape. TASK-294 has no dependency on the others; TASK-295 comes before TASK-299.
