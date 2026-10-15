# Coming from Solid

> Solid is the closest model, components set up once with fine-grained signals, so this guide is about the differences: signal and store APIs, props, control flow as plain JSX, async components, `.stsx` styles, islands, and SolidStart and Solid Router mapped to file routes, endpoints and form actions.

This page maps Solid 1.x, Solid Router and SolidStart to Lumiose's current API. The linked pages
have the full rules.

## Mental model

**The same core idea.** As in Solid, a component body runs once, JSX expressions that read signals
compile to bindings that update their part of the DOM, and there is no virtual DOM. Owners,
`onCleanup`, context and `untrack` work the way you expect ([Signals](../concepts/signals.md)).
Lumiose's names follow Solid and React where the behaviour matches, without Solid's `create`
prefix: `signal`, `computed`, `effect`, `store`.

**The differences are in the details:**

- **A signal is one function**, not a `[get, set]` tuple: `count()` reads, `count.set(1)` and
  `count.update((n) => n + 1)` write.
- **Props destructure safely.** The compiler rewrites destructured component parameters, with
  defaults and `...rest`, into reads of `props.x`, so `({ title, size = "md" })` stays reactive. No
  `splitProps` or `mergeProps`.
- **Control flow is plain JSX.** There is no `<Show>`, `<For>` or `<Switch>`: the compiler turns
  `.map()` into a keyed list, ternaries and `&&` into memoised branches, and
  `item.id === selected()` inside `.map()` into a selector ([JSX](../concepts/jsx.md)).
- **Async components replace resources.** A component may be `async` and `await` its data on the
  server and in the browser; `<Suspense>` and `<ErrorBoundary>` work as in Solid
  ([Async components](../concepts/async.md)).
- **Styles live with the component.** `.stsx` files are TSX plus raw-CSS `<style>` blocks, scoped by
  where they are placed ([Styles](../concepts/styles.md)).

**Server first, with islands.** SolidStart renders the app on the server and hydrates all of it. In
Lumiose, `static` and `server` pages ship no JavaScript, and a `client:*` directive at the usage
site makes one component instance an [island](../concepts/islands.md): `<Todos client:load />`.
An `spa` route is the SolidStart experience: server-rendered, hydrated, client-side navigation with
persistent layouts ([Rendering modes](../concepts/rendering-modes.md)).

## From Solid to Lumiose

### Reactivity

| Solid                                                 | Lumiose                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `const [count, setCount] = createSignal(0)`           | `const count = signal(0)`: `count()`, `count.set(1)`, `count.update((n) => n + 1)`, `count.peek()`.                                                  |
| `createSignal(v, { equals: false })`                  | `signal(v, { equals: false })`.                                                                                                                      |
| `createMemo(fn)`                                      | `computed(fn)`: lazy, cached, and `fn` receives the previous value.                                                                                  |
| `createEffect(fn)`                                    | `effect(fn)`; it may return its cleanup, or call `onCleanup()`.                                                                                      |
| `createRenderEffect`, `createComputed`                | JSX bindings and `computed`: effects run after the DOM writes of the same flush.                                                                     |
| `on(deps, fn)`                                        | Read the dependencies, then `untrack(() => …)` for the rest.                                                                                         |
| `onMount`, `onCleanup`, `batch`, `untrack`            | The same names.                                                                                                                                      |
| `createStore(value)` and `setStore(path…, value)`     | `store(value)`: a deep, mutable proxy, written directly (`state.todos[0].done = true`), like `createMutable`.                                        |
| `produce(fn)`                                         | Write to the store directly.                                                                                                                         |
| `reconcile(data)`                                     | `reconcile(target, data, { key })`, with Solid's semantics ([reference](../reference/reactivity.md#reconcile)).                                      |
| `unwrap(store)`                                       | `snapshot(store)`: a deep plain copy.                                                                                                                |
| `createSelector(selected)`                            | Compiled for you: `item.id === selected()` inside `.map()`.                                                                                          |
| `createContext`, `<Ctx.Provider value>`, `useContext` | `createContext`, `<Ctx value>` (the context is its own provider), `useContext`. Provide a signal or a store for state that changes.                  |
| `createUniqueId()`                                    | `useId()`, the same after hydration.                                                                                                                 |
| `createResource(source, fetcher)`                     | An `async` component that awaits `fetchJSON()` or `query()`; `resource(fetcher)` is the low-level form, with `loading()`, `error()` and `refetch()`. |
| `useTransition()`, `startTransition()`                | Async re-runs keep the old UI until the new data is ready: `isPending()` inside the component, `isBusy()` for anything in flight.                    |
| `isServer`                                            | `isServer` from `lumiose`, folded away in client builds.                                                                                             |

### Components and JSX

| Solid                                                            | Lumiose                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `splitProps(props, ["a"])`, `mergeProps(defaults, props)`        | `({ a, size = "md", ...rest })`: destructuring with defaults and rest stays reactive.                                   |
| `children(() => props.children)`                                 | Insert `children` once where it goes; take a render prop to render content several times.                               |
| `<Show when={user()} fallback={<Login />}>`                      | `{user() ? <Profile /> : <Login />}`, or `{user() && <Profile />}`.                                                     |
| `<Show when={user()} keyed>{(u) => …}</Show>`                    | `{user() ? <Profile user={user()!} /> : null}`: the branch switches when the condition flips, and the prop stays live.  |
| `<For each={items()}>{(item, i) => …}</For>`                     | `{items().map((item, i) => …)}`, keyed by reference or `key`; `i` is a reactive index, used as a number (`i + 1`).      |
| `<Index each={items()}>`                                         | No index-keyed list: keep objects in a `store` and change their properties, so rows update in place.                    |
| `<Switch>` and `<Match>`                                         | A chain of ternaries, or a function that returns JSX: `{view()}` with `const view = () => { switch (status()) { … } }`. |
| `<Dynamic component={…}>`, `<Portal mount={…}>`                  | The same: `<Dynamic component={…}>` and `<Portal mount={…}>`.                                                           |
| `<ErrorBoundary fallback={(err, reset) => …}>`, `<Suspense>`     | The same.                                                                                                               |
| `let el; <div ref={el} />`                                       | `const el = ref<HTMLDivElement>()`, `<div ref={el} />` and `el()`; or a callback `ref={(node) => …}`.                   |
| `use:tooltip={text}`                                             | `attach={[tooltip(text)]}`, where `tooltip(text)` returns `(el) => cleanup`.                                            |
| `classList={{ active: on() }}`                                   | `class={{ active: on() }}`; `class` also takes strings and arrays.                                                      |
| `style={{ "font-weight": 600 }}`, `on:click`, `onClick`          | The same: kebab-case style keys, native `on:` listeners and delegated `onX` handlers.                                   |
| `lazy(() => import("./Chart"))`                                  | No `lazy()`: islands load their module when they hydrate, and `spa` routes load a chunk per page and layout.            |
| `render(() => <App />, el)`, `hydrate`                           | `render(() => <App />, el)` from `lumiose/dom`; islands and `spa` routes hydrate on their own.                          |
| `renderToString`, `renderToStream`                               | The same names from `lumiose/server` ([reference](../reference/server.md)).                                             |
| CSS files, CSS Modules, `solid-styled`                           | A `<style>` block in the `.stsx` file, scoped by placement; `<style global>` for global rules.                          |
| `@solidjs/meta`: `<Title>`, `<Meta>`, `<Link>`, `<MetaProvider>` | `<Title>`, `<Meta>` and `<Head>` from `lumiose`, with no provider ([Head and document](../concepts/head.md)).           |

### SolidStart

| SolidStart                                                            | Lumiose                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.config.ts` (Vinxi)                                               | `vite.config.ts` with the `lumiose()` plugin.                                                                                               |
| `src/routes/index.tsx`, `about.tsx`                                   | `src/routes/page.stsx`, `about/page.stsx`: a folder is a URL segment.                                                                       |
| `blog/[slug].tsx`, `[[id]].tsx`, `[...rest].tsx`, `(group)`           | `blog/[slug]/page.stsx`, `[[id]]/page.stsx`, `[...rest]` (one or more segments) or `[[...rest]]` (zero or more), `(group)`.                 |
| `blog.tsx` next to `blog/` (a layout)                                 | `blog/layout.stsx`; `props.children` is the outlet.                                                                                         |
| API routes: `export function GET(event)`                              | `route.ts` endpoints: `export const GET: Endpoint<"/api/x"> = (ctx) => Response`.                                                           |
| `query(fn, "key")` and `createAsync(() => getUser(id))`               | `await query(["user", id], () => getUser(id))` in an async component (key first, an array as in TanStack Query), or `await fetchJSON(url)`. |
| `"use server"` functions                                              | No RPC: form actions for mutations, endpoints for anything the browser fetches, and `*.server.ts` modules for server-only code.             |
| `action(fn)` and `<form action={myAction} method="post">`             | `export const actions = { save(ctx) {…} }` and `<form method="post" action="?/save">`, which works without JavaScript.                      |
| `useAction(myAction)`                                                 | `submit(target, { action: "?/save" })` from an island or `spa` route.                                                                       |
| `useSubmission(myAction)`: `pending`, `result`                        | `isSubmitting("save")`, and `actionData()` or the result that `await submit(…)` resolves to.                                                |
| `revalidate(key)`, `reload()`                                         | `invalidate(["key"])` refetches matching `query()` entries; `invalidate()` refreshes the page.                                              |
| `redirect()`, `json()` from an action                                 | `redirect(to)` (it throws), and plain data as the return value; `fail(status, data)` for validation errors.                                 |
| `entry-server.tsx` with `<StartServer document>`                      | `src/document.stsx` renders `{props.head}` and `{props.body}`.                                                                              |
| `entry-client.tsx`, `app.tsx` with `<Router root>` and `<FileRoutes>` | No files: the router is built in; `src/routes/layout.stsx` is the root layout.                                                              |
| `createMiddleware({ onRequest, onBeforeResponse })`                   | `src/middleware.ts`: `(ctx, next) => Response`, code before and after `await next()`; a `middleware.ts` in a route folder for its routes.   |
| `event.locals`, `getRequestEvent()`                                   | `ctx.locals` (typed by augmenting `Locals`); `request()`, `locals()`, `cookies()` and `url()` during a server render.                       |
| `useSession()`                                                        | `cookies` and `signedCookie(name)` ([Server](../concepts/server.md)).                                                                       |
| `clientOnly(() => import("./Map"))`                                   | `client:only` on the usage: `<Map client:only />`.                                                                                          |
| `ssr: false`, prerendering (`server.prerender`)                       | `lumiose({ mode: "spa", ssr: false })`; `static` routes (the default) with `staticPaths()`, and `prerender = true` on `spa` pages.          |
| Deployment presets                                                    | `@lumiose/adapter-node`, or `lumiose({ adapter })` for Vercel, Netlify and Cloudflare ([Deploy](../deploy/README.md)).                      |

### Solid Router

| Solid Router                                 | Lumiose                                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `<Router>` with `<Route path component>`     | File routes; `lumiose routes` lists them.                                                                       |
| `<A href>`, `activeClass`                    | `<Link href>` from `lumiose/router`, with `aria-current="page"` on the active link; `href()` builds typed URLs. |
| `useNavigate()`, `<Navigate href>`           | `navigate(href, { replace })`; `redirect(to)` while rendering.                                                  |
| `useParams()`, `useLocation()`, `useMatch()` | `params()`, `url()` and `route()` (the matched pattern) from `lumiose/router`.                                  |
| `useSearchParams()`: `[params, setParams]`   | `searchParams()` and `searchParams.set({ q })`.                                                                 |
| `useIsRouting()`                             | `isNavigating()`.                                                                                               |
| `preload` functions on routes                | None: data loads where it is awaited, and `<Link prefetch>` loads a page's modules ahead.                       |

## What has no equivalent

| Solid                                                     | Instead                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRoot`, `getOwner`, `runWithOwner`                  | Not public: components, effects and `render()` create owners, and async components restore theirs after each `await`.                                                     |
| `createDeferred`, `createReaction`, `observable`, `from`  | None. Bridge an external source with a signal set from its subscription ([an external store](../concepts/state.md#an-external-store-zustandvanilla-a-jotai-store-redux)). |
| `<Index>`, `mapArray`, `indexArray`                       | `.map()` in JSX; see the `<Index>` row above.                                                                                                                             |
| `<SuspenseList>`                                          | None: give each `<Suspense>` its own fallback.                                                                                                                            |
| `lazy()`                                                  | None: code splits per island and per `spa` page.                                                                                                                          |
| Server functions (`"use server"`) called like functions   | Form actions and endpoints. Calling an endpoint with `fetchJSON()` from an island keeps the network boundary visible.                                                     |
| `useSubmission()` per action instance, `useSubmissions()` | This version has no per-instance submission handle: keep each `await submit(…)` result in a signal of the component that sent it.                                         |
| `useBeforeLeave()`                                        | This version has no navigation guards. A `beforeunload` listener covers leaving the document.                                                                             |
| `preload` and `query` preloading on hover                 | `<Link prefetch>` loads the page's modules; data loads when the page renders.                                                                                             |
| Solid component libraries (Kobalte, Corvu)                | They target Solid's runtime and do not run. Use native elements (`<dialog>`, `popover`), web components or framework-agnostic libraries.                                  |

## Example

A filtered todo list, in Solid:

```tsx
import { createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

export function Todos(props: { title: string }) {
  const [todos, setTodos] = createStore([{ id: 1, text: "Write the docs", done: false }]);
  const [filter, setFilter] = createSignal<"all" | "open">("all");
  const visible = createMemo(() =>
    filter() === "open" ? todos.filter((todo) => !todo.done) : todos,
  );

  return (
    <section>
      <h2>{props.title}</h2>
      <button onClick={() => setFilter((f) => (f === "all" ? "open" : "all"))}>
        Show {filter() === "all" ? "open" : "all"}
      </button>
      <Show when={visible().length > 0} fallback={<p>Nothing to do.</p>}>
        <ul>
          <For each={visible()}>
            {(todo, i) => (
              <li classList={{ done: todo.done }}>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() =>
                    setTodos(
                      (t) => t.id === todo.id,
                      "done",
                      (done) => !done,
                    )
                  }
                />
                {i() + 1}. {todo.text}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
```

The same list in Lumiose, with its styles in the file. The props are destructured, the store is
written directly, and the control flow is a ternary and `.map()`:

```stsx check file=components/Todos.stsx
// src/components/Todos.stsx
import { computed, signal, store } from "lumiose";

export function Todos({ title }: { title: string }) {
  const todos = store([{ id: 1, text: "Write the docs", done: false }]);
  const filter = signal<"all" | "open">("all");
  const visible = computed(() =>
    filter() === "open" ? todos.filter((todo) => !todo.done) : todos,
  );

  return (
    <section>
      <h2>{title}</h2>
      <button onClick={() => filter.update((f) => (f === "all" ? "open" : "all"))}>
        Show {filter() === "all" ? "open" : "all"}
      </button>
      {visible().length > 0 ? (
        <ul>
          {visible().map((todo, i) => (
            <li key={todo.id} class={{ done: todo.done }}>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => {
                  todo.done = !todo.done;
                }}
              />
              {i + 1}. {todo.text}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing to do.</p>
      )}
    </section>
  );
}

<style>
  .done { color: gray; text-decoration: line-through; }
</style>
```

A SolidStart route that reads with `query()` and `createAsync()` and writes with an `action()`
becomes a page with an async component and a form action. Without JavaScript the form posts and
the page re-renders with the action's data:

```stsx check file=routes/members/[id]/page.stsx
// src/routes/members/[id]/page.stsx
import {
  Title,
  actionData,
  fail,
  href,
  notFound,
  query,
  redirect,
  type ActionContext,
  type PageProps,
} from "lumiose";
import { Todos } from "../../../components/Todos.stsx";

export const mode = "server";

const members = new Map([["1", { name: "Ada", bio: "" }]]); // a database in a real app

export const actions = {
  async save(ctx: ActionContext<"/members/[id]">) {
    const bio = String((await ctx.formData()).get("bio") ?? "");
    if (bio.length > 200) return fail(400, { error: "Keep it under 200 characters." });
    const member = members.get(ctx.params.id) ?? notFound();
    member.bio = bio;
    redirect(href("/members/[id]", { id: ctx.params.id }));
  },
};

export default async function Member({ params }: PageProps<"/members/[id]">) {
  // One query per request and key, however many components await it.
  const member = (await query(["member", params.id], async () => members.get(params.id))) ?? notFound();
  return (
    <main>
      <Title>{member.name}</Title>
      <h1>{member.name}</h1>
      <form method="post" action="?/save">
        <textarea name="bio">{member.bio}</textarea>
        <p>{actionData<typeof actions>()?.error}</p>
        <button>Save</button>
      </form>
      <Todos client:visible title={`${member.name}'s tasks`} />
    </main>
  );
}
```

## Common mistakes

- **Destructuring a signal tuple.** `const [count, setCount] = signal(0)` is a type error: a signal
  is one function with `.set()` and `.update()`.
- **`<Show>`, `<For>` or `<Switch>`.** They do not exist. Write ternaries and `.map()`; the compiler
  makes them fine-grained.
- **Calling the index: `i()`.** In `.map((item, i) => …)`, `i` is used as a number; the compiler
  keeps it reactive. Passing it out of the callback is [LUM2006](../errors/LUM2006.md).
- **`setStore` paths.** A store is written directly: `todo.done = true`,
  `state.items.push(item)`.
- **`splitProps` to keep props reactive.** Destructure instead; the compiler keeps the reads
  reactive. Copying a signal's value into a variable is what freezes it
  ([LUM2001](../errors/LUM2001.md)).
- **An early return on a signal.** `if (!user()) return <Login />` runs once, as in Solid; branch in
  the JSX ([LUM2003](../errors/LUM2003.md)).
- **`query(fn, "key")`.** Lumiose's `query` takes the key first, as an array: `query(["user", id], fn)`.
- **An interactive component on a page without `client:*`.** It renders on the server, and its
  handlers never run. Add a directive at the usage site, or make the route `spa`.
- **Expecting page context inside an island.** Islands start a new root, so context provided by the
  page does not reach them ([LUM4010](../errors/LUM4010.md)): pass a prop, or use `defineState`.
- **A server function imported into an island.** Importing a `*.server.ts` module from browser code
  is [LUM4003](../errors/LUM4003.md). Post to a form action or call an endpoint.

## Related

- [Signals and reactivity](../concepts/signals.md): `signal`, `computed`, `effect`, `store`, owners and scheduling.
- [JSX](../concepts/jsx.md): bindings, the compiled `.map()`, ternaries and selectors, `class`, `style`, `attach` and `ref`.
- [Components](../concepts/components.md): setup once, props destructuring, children and refs.
- [Styles](../concepts/styles.md): `<style>` blocks scoped by placement.
- [Async components](../concepts/async.md): awaiting data, `<Suspense>`, `<ErrorBoundary>` and the request cache.
- [Islands](../concepts/islands.md) and [Rendering modes](../concepts/rendering-modes.md): what ships to the browser.
- [Routing](../concepts/routing.md), [Data and actions](../concepts/data-and-actions.md) and [`lumiose/router`](../reference/router.md): the SolidStart and Solid Router side.
