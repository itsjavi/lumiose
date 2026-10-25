# Data and actions

> Read data in async components, serve APIs from endpoints and change data with form actions: one way to do each, with no loaders or RPC.

## Concept

**Reading: async components.** Await data in the component that needs it. Server-only data
access (databases, secrets) lives in `*.server.ts` modules or `src/server/`. See
[Async components](async.md).

**HTTP APIs: endpoints.** A `route.ts` file under `src/routes` exports handlers named after HTTP
methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (and `HEAD`, `OPTIONS`), each
`(ctx) => Response`. Islands, SPA code and other clients call them with `fetch` or `fetchJSON`.

**`fetchJSON<T>(url, init?)`** fetches JSON and returns plain data, so awaited results stay
serializable inside islands. Non-2xx responses throw a `FetchError` (an `HttpError` with `status`,
`url` and the parsed body as `data`); if a server component lets it escape, the page renders
`error` (or `not-found`) page with that status. **During SSR, same-origin URLs are served in-process**, with
the page request's cookies, without a network round-trip. **Awaited in an async component, a GET
is cached by URL**: components awaiting the same URL share one request, and in the browser cached
data shows at once and revalidates in the background; `{ cache: "no-store" }` opts a request out.
`query(key, fn)` caches other data under an array key, and passes `fn` TanStack's
`{ signal, queryKey }`. See [Async components](async.md) and [reference: query](../reference/app.md#query).

**Mutations: form actions.** A page exports `action(ctx)` or named `actions = { name(ctx) }`. A
`<form method="post">` posts to the page (or to `?/name` for a named action) and works without
JavaScript. A named action's URL may keep the page's other query parameters: the action is the
parameter that starts with `/`, wherever it is, so `?status=open&/close` runs `close`, and
`ctx.url` still has `status=open` (useful to redirect back to a filtered list). An action receives
`ctx.formData()` and returns:

| Return                         | Result                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `redirect(to)` or a `Response` | Sent as is (303 after a POST).                                                                  |
| plain data                     | The page re-renders (200) and `actionData()` returns the data.                                  |
| `fail(status, data)`           | The page re-renders with `status`; `actionData()` returns `data`. Use it for validation errors. |

**Keeping what the user entered.** After a failed submission, send back the values to fill in
again with the errors, so the page renders the form filled in and nobody types everything again
(WCAG 3.3.7). Name the fields you send back:
`return fail(400, { errors, values: { username, email } })`. Everything in `actionData()` data is
embedded in the re-rendered page, so a password, a token or a card number in it would sit in the
HTML, within reach of every script on the page. A `FormData` works too (its text entries; files are
left out), but it carries every field of the form: in development, Lumiose warns when one carries a
name that looks secret (`password`, `pwd`, `token`, `otp`, `card`, `ssn`, `iban`, `privateKey`,
`sessionId`, …, in camelCase too, such as `passwordConfirm`).
@lumiose/ui's [Form](https://lumiose.dev/ui/form/) takes them as `values` and fills its
controls by name; with your own inputs, use them as `defaultValue`s.

An Origin check protects page POSTs and form-encoded endpoint requests by default (403 for
cross-site requests).

**Enhancing forms.** Inside an island, `onSubmit={submit}` posts the form without a page load.
`submit()` resolves to `{ type: "success", status, data }`, `{ type: "failure", status, data }` or
follows a redirect, and sets `actionData()`. It rejects only for unexpected errors, with a
`FetchError`. `isSubmitting(name?)` is true while a submission is in flight.

**Per-instance submissions.** `isSubmitting(name)` and `actionData()` are page-wide: rows of a
list that post the same action would share one pending flag and overwrite each other's result.
`submission()` gives a component its own handle, created during setup:
`const toggle = submission<typeof actions.toggle>()`, then `onSubmit={toggle.submit}`.
`toggle.isSubmitting()`, `toggle.result()` (the last `{ type: "success" | "failure", status, data }`,
typed from the action) and `toggle.error()` (the last unexpected `FetchError`) are this instance's
only. `toggle.submit()` takes what `submit()` takes and returns the same promise; a new submission
on the handle aborts the one in flight, `toggle.abort()` cancels it (the handle is idle at once,
and an abort is no error), `toggle.reset()` clears the result and the error, and disposing the
component aborts too. A handle never sets `actionData()`, while `isSubmitting(name)` still counts
it; SPA refreshing, `invalidate` targets and `optimistic()` work as with `submit()`. Errors land
in `error()`, so `onSubmit={toggle.submit}` reports no unhandled rejection; redirects navigate
and leave `result()` as it was.

**Refreshing.** `invalidate()` re-runs the current page's async components (SPA; the stale UI stays
until the new data arrives), or reloads the page (MPA). On client-routed (SPA) pages a successful
`submit()` runs it for you, so the page shows the mutation without extra code; pass
`submit(form, { invalidate: false })` to keep the page as it is. On MPA pages a successful
`submit()` never reloads: an island owns only its own state, so it updates itself from the result
(`result.data`, `actionData()`). Call `invalidate()` yourself when the page needs fresh
server-rendered content; on MPA pages that reloads and resets `actionData()`.

**Refreshing only what changed.** `invalidate(...targets)` refetches cache entries and re-runs only
the async components that awaited them, on SPA and MPA pages alike (islands included, no reload):
a string is a URL (the `fetchJSON` entry of that URL), an array a `query()` key prefix.
`submit(form, { invalidate: ["/api/books/1", ["stats"]] })` does the same after a successful
submission, instead of refreshing the whole page. Components rendered only on the server (outside
islands) are not re-run by a target: use `invalidate()` for those.

**Optimistic updates.** `optimistic(source)` follows `source` (a getter such as `() => props.likes`,
or a signal) and shows an overlay while a promise is pending: `likes.update((n) => n + 1,
submit(event))` or `likes.set(value, promise)`. When the promise settles the overlay drops:
on success the source already holds the new value, on failure (a `fail()` result or a rejection)
the value rolls back. On SPA pages `submit()` resolves after its `invalidate()`, so the refreshed
data replaces the overlay in the same task, with no flicker back. On MPA pages read the new value
from the result (`actionData()?.likes ?? props.likes` as the source), or pass
`submit(event).then(() => invalidate())`: the MPA `invalidate()` reloads and never settles, so the
overlay holds until the page unloads. Overlays apply in call order and drop independently, and an
`update` re-applies over the latest source. `optimistic` does not re-throw a rejection: await
`submit()` yourself to handle errors.

**Typed results.** Type an action's parameter with its page pattern,
`(ctx: ActionContext<"/books/new">)`, and let TypeScript infer what it returns:
`actionData<typeof actions>()` (or `typeof action`) is the union of the data the actions return
and the data they pass to `fail()`, or `undefined` before a submission. `submit<typeof actions.create>(form)`
resolves with `{ type: "success", data }` or `{ type: "failure", data }` typed from that action,
so the two are told apart by `type`; `actionData()` data is told apart by its shape.
`ActionData<typeof actions>` names that type for a child component's props. An island that posts to another page's action imports the
type only: `import type { actions } from "../routes/reading-list/page.stsx"`.

## API

| API                                                                  | Shape                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `export const GET: Endpoint<"/api/x"> = (ctx) => Response`           | An endpoint method; `ctx.params` typed by the pattern.                    |
| `export const action = async (ctx: ActionContext<"/x">) => …`        | The default form action of a page.                                        |
| `export const actions = { name: (ctx: ActionContext<"/x">) => … }`   | Named actions, posted to `?/name`.                                        |
| `ctx.formData()`                                                     | The request body as `FormData` (400 if it is not a form).                 |
| `fail(status, data?)`                                                | A failed action result.                                                   |
| `actionData<typeof actions>()`                                       | The last action's data or `fail` data, typed by the actions. Reactive.    |
| `submit(target, { action?, method?, signal?, invalidate? })`         | Post a form, submit event, `FormData`, `URLSearchParams` or a record.     |
| `submit(target, { invalidate: [url, key] })`                         | The same, refetching only those cache entries after a success.            |
| `submit<typeof actions.name>(…)`                                     | The same, resolving with that action's typed success and failure data.    |
| `isSubmitting(name?)`                                                | Whether a submission (to `?/name`) is in flight.                          |
| `submission<typeof actions.name>()`                                  | This component's `{ submit, isSubmitting, result, error, abort, reset }`. |
| `invalidate()`                                                       | Refresh the current page's server data.                                   |
| `invalidate(...targets)`                                             | Refetch the entries of URLs and `query()` key prefixes.                   |
| `query(key, fn)`                                                     | Awaited in a component, cache what `fn` resolves to under `key`.          |
| `optimistic(source)`, `.set(value, promise)`, `.update(fn, promise)` | A value with overlays held while their promises are pending.              |
| `fetchJSON<T>(url, init?)`, `isFetchError(e)`                        | JSON fetch with typed errors; cached by URL in components.                |

## Example

```ts check file=routes/api/books/route.ts
// src/routes/api/books/route.ts: GET /api/books?q=…
import type { Endpoint } from "lumiose";

const books = [{ id: "1", title: "Dune" }];

export const GET: Endpoint<"/api/books"> = ({ url }) => {
  const q = url.searchParams.get("q")?.toLowerCase() ?? "";
  return Response.json(books.filter((book) => book.title.toLowerCase().includes(q)));
};
```

```stsx check file=routes/books/new/page.stsx
// src/routes/books/new/page.stsx: a form that works without JS, enhanced when it hydrates
import { actionData, fail, redirect, submit, isSubmitting, type ActionContext } from "lumiose";

interface Errors {
  title?: string;
}

export const mode = "server";

export const actions = {
  async create(ctx: ActionContext<"/books/new">) {
    const form = await ctx.formData();
    const title = String(form.get("title") ?? "").trim();
    if (title === "") return fail(400, { title: "A title is required." } satisfies Errors);
    // await db.books.insert({ title });
    redirect("/books");
  },
};

export function NewBookForm() {
  return (
    <form method="post" action="?/create" onSubmit={submit}>
      <input name="title" />
      <p class="error">{actionData<typeof actions>()?.title}</p>
      <button disabled={isSubmitting("create")}>Add book</button>
    </form>
  );
}

export default function NewBook() {
  return (
    <main>
      <h1>New book</h1>
      <NewBookForm client:load />
    </main>
  );
}
```

```tsx check
import { fetchJSON, isFetchError } from "lumiose";

export async function BookSearch({ q }: { q: string }) {
  try {
    const books = await fetchJSON<{ id: string; title: string }[]>(
      `/api/books?q=${encodeURIComponent(q)}`,
    );
    return (
      <ul>
        {books.map((book) => (
          <li key={book.id}>{book.title}</li>
        ))}
      </ul>
    );
  } catch (error) {
    if (isFetchError(error) && error.status === 404) return <p>No books.</p>;
    throw error;
  }
}
```

A like button that counts at once and rolls back if the post fails. The page is MPA, so the island
reads the new count from the action's result; on an SPA page `() => props.likes` is enough, as
`submit()` refreshes the props before it resolves:

```stsx check file=routes/likes/[id]/page.stsx
// src/routes/likes/[id]/page.stsx
import { actionData, optimistic, submit, type ActionContext } from "lumiose";

export const mode = "server";

let count = 3; // a database in a real app

export const actions = {
  like(_ctx: ActionContext<"/likes/[id]">) {
    count += 1;
    return { likes: count };
  },
};

export function LikeButton(props: { likes: number }) {
  const likes = optimistic(() => actionData<typeof actions>()?.likes ?? props.likes);
  return (
    <form
      method="post"
      action="?/like"
      onSubmit={(event) => likes.update((n) => n + 1, submit(event))}
    >
      <button>Like ({likes()})</button>
    </form>
  );
}

export default function Post() {
  return <LikeButton client:load likes={count} />;
}
```

Rows that post the same action, each with its own pending state and result:

```stsx check file=routes/checklist/page.stsx
// src/routes/checklist/page.stsx
import { submission, type ActionContext } from "lumiose";

export const mode = "server";

const done = new Set<string>(); // a database in a real app

export const actions = {
  async toggle(ctx: ActionContext<"/checklist">) {
    const id = String((await ctx.formData()).get("id"));
    if (done.has(id)) done.delete(id);
    else done.add(id);
    return { id, done: done.has(id) };
  },
};

export function Row(props: { id: string; label: string; done: boolean }) {
  const toggle = submission<typeof actions.toggle>();
  const isDone = () => {
    const result = toggle.result();
    return result?.type === "success" ? result.data.done : props.done;
  };
  return (
    <form method="post" action="?/toggle" onSubmit={toggle.submit}>
      <input type="hidden" name="id" value={props.id} />
      <button disabled={toggle.isSubmitting()}>
        {isDone() ? "✓" : "○"} {props.label}
      </button>
      {toggle.error() ? <span class="error">Not saved</span> : null}
    </form>
  );
}

export default function Checklist() {
  return (
    <ul>
      {["milk", "eggs", "bread"].map((item) => (
        <li>
          <Row client:load id={item} label={item} done={done.has(item)} />
        </li>
      ))}
    </ul>
  );
}
```

Keeping the page's filters through a named action:

```stsx check file=routes/issues/page.stsx
// src/routes/issues/page.stsx: the list is filtered by ?status=; "Close" keeps the filter
import { redirect, url, type ActionContext } from "lumiose";

export const mode = "server";

export const actions = {
  async close(ctx: ActionContext) {
    // await db.issues.close((await ctx.formData()).getAll("ids"));
    const back = new URL(ctx.url);
    back.searchParams.delete("/close"); // the action key; the filters stay
    redirect(back.pathname + back.search);
  },
};

export default function Issues() {
  const search = url().search; // "?status=open", or ""
  return (
    <form method="post" action={`${search === "" ? "?" : `${search}&`}/close`}>
      {/* rows with <input type="checkbox" name="ids" value={id} /> */}
      <button>Close selected</button>
    </form>
  );
}
```

## Common mistakes

- **Route loaders.** Lumiose has none. Await data in the page component; it is the same code on every
  route mode.
- **Calling server code from an island.** Import nothing from `*.server.ts` in island code
  (`LUM4003`); expose an endpoint and call it with `fetchJSON`.
- **`fetch()` instead of `fetchJSON()` inside islands.** A `Response` is not serializable
  (`LUM4007`).
- **One `isSubmitting(name)` for several forms.** Rows that post the same action share it, and
  `actionData()` holds whichever answered last. Give each row a `submission()`.
- **Expecting `submit()` to reject on validation errors.** `fail()` resolves with
  `{ type: "failure" }`; only unexpected errors reject.
- **Calling `invalidate()` after a successful `submit()` on an SPA page.** `submit()` already did;
  a second call refreshes twice.
- **Reaching for a client cache library first.** `fetchJSON` and `query` already dedupe, cache and
  revalidate component awaits on the server and in the browser. Use
  [`@lumiose/query`](../reference/query.md) for client data that needs polling, refetching on focus,
  retries or per-query stale times.
- **Expecting an MPA page to refresh after `submit()`.** On MPA pages `submit()` never reloads.
  Update the island from the result (a toggle sets its own state, a list removes its own row), or
  call `invalidate()` explicitly if the page must show fresh server HTML.
- **Leaving an optimistic overlay up after the request.** Pass the promise to `set`/`update`
  rather than resetting by hand, and on MPA pages give the island a source that changes
  (`actionData()`, or an explicit `invalidate()`), or the value returns to the old one on success.
- **Forms without `method="post"`.** Actions only run for POST; `submit()` refuses a form that does
  not say `method="post"`, as the no-JS form would not post either.
- **Throwing for validation errors.** A thrown error renders the `error` page. Return
  `fail(400, data)`.
- **Casting action data.** `actionData<{ errors: … }>()` is a type error: pass `typeof actions`.
  Annotating the export with `Action` (`export const action: Action = …`) hides what it returns,
  so annotate the parameter instead, or check it with `satisfies Action<"/x">`. Add
  `satisfies YourFailure` to `fail()` data whose string literals should stay literal.
- **Disabling the Origin check to make a cross-site form work.** Allow the specific origin instead
  (`lumiose({ csrf: { allowedOrigins } })` in `vite.config.ts`).

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.

See also: [Server](server.md), [Routing](routing.md), [reference: app layer](../reference/app.md).
