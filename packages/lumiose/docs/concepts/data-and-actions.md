# Data and actions

> Read data in async components, serve APIs from endpoints and change data with form actions: one way to do each, with no loaders or RPC.

## Concept

### Read data

A `route.ts` file exports handlers named after HTTP methods. A component awaits `fetchJSON`: during
SSR a same-origin URL is served in-process, and a GET awaited in a component is cached by URL.

```ts check file=routes/api/books/route.ts
import type { Endpoint } from "lumiose";

const books = [{ id: "1", title: "Dune" }];

export const GET: Endpoint<"/api/books"> = ({ url }) => {
  const q = url.searchParams.get("q")?.toLowerCase() ?? "";
  return Response.json(books.filter((book) => book.title.toLowerCase().includes(q)));
};
```

```tsx check
import { fetchJSON, isFetchError } from "lumiose";

type Book = { id: string; title: string };

export async function BookSearch({ q }: { q: string }) {
  try {
    const books = await fetchJSON<Book[]>(`/api/books?q=${encodeURIComponent(q)}`);
    return (
      <ul>
        {books.map((book) => (
          <li key={book.id}>{book.title}</li>
        ))}
      </ul>
    );
  } catch (error) {
    if (isFetchError(error) && error.status === 404) {
      return <p>No books.</p>;
    }
    throw error;
  }
}
```

### Change data

A page exports `actions`. The form posts to `?/create` and works without JavaScript; `submit`
enhances it in an island. `fail()` re-renders the page with the errors in `actionData()`.

```stsx check file=routes/books/new/page.stsx
import {
  actionData,
  fail,
  isSubmitting,
  redirect,
  submit,
  type ActionContext,
} from "lumiose";

interface Errors {
  title?: string;
}

export const mode = "server";

export const actions = {
  async create(ctx: ActionContext<"/books/new">) {
    const form = await ctx.formData();
    const title = String(form.get("title") ?? "").trim();
    if (title === "") {
      const errors = { title: "A title is required." };
      return fail(400, errors satisfies Errors);
    }
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

> **Details:** what an action may return, keeping what the user entered, the Origin check,
> `submission()` per row, refreshing, optimistic updates and typed results, with more examples:
> [Data and actions in detail](../reference/app.md#data-and-actions-in-detail). Server-only data
> access lives in `*.server.ts` modules or `src/server/` ([Server](server.md)).

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
| `submit<typeof actions.name>(…)`                                     | The same, resolving with that action's typed success and failure data.    |
| `isSubmitting(name?)`                                                | Whether a submission (to `?/name`) is in flight.                          |
| `submission<typeof actions.name>()`                                  | This component's `{ submit, isSubmitting, result, error, abort, reset }`. |
| `invalidate()`, `invalidate(...targets)`                             | Refresh the page's server data, or only URLs and `query()` key prefixes.  |
| `query(key, fn)`                                                     | Awaited in a component, cache what `fn` resolves to under `key`.          |
| `optimistic(source)`, `.set(value, promise)`, `.update(fn, promise)` | A value with overlays held while their promises are pending.              |
| `fetchJSON<T>(url, init?)`, `isFetchError(e)`                        | JSON fetch with typed errors; cached by URL in components.                |

Signatures: [reference: app layer](../reference/app.md).

## Example

A like button that counts at once and rolls back if the post fails. The page is MPA, so the island
reads the new count from the action's result. On an SPA page `() => props.likes` is enough, as
`submit()` refreshes the props before it resolves.

```stsx check file=routes/likes/[id]/page.stsx
import {
  actionData,
  optimistic,
  submit,
  type ActionContext,
} from "lumiose";

export const mode = "server";

let count = 3; // a database in a real app

export const actions = {
  like(_ctx: ActionContext<"/likes/[id]">) {
    count += 1;
    return { likes: count };
  },
};

export function LikeButton(props: { likes: number }) {
  const likes = optimistic(
    () => actionData<typeof actions>()?.likes ?? props.likes,
  );
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

## Common mistakes

Each in full: [Data and actions in detail](../reference/app.md#data-and-actions-in-detail).

- **Route loaders.** There are none: await data in the page component.
- **Calling server code from an island** (`LUM4003`). Expose an endpoint.
- **`fetch()` instead of `fetchJSON()` inside islands** (`LUM4007`).
- **One `isSubmitting(name)` for several forms.** Give each row a `submission()`.
- **Expecting `submit()` to reject on validation errors.** `fail()` resolves as a failure.
- **`invalidate()` after a successful `submit()` on an SPA page.** `submit()` already did.
- **A client cache library first.** `fetchJSON` and `query` already cache;
  [`@lumiose/query`](../reference/query.md) adds polling and retries.
- **Expecting an MPA page to refresh after `submit()`.** Update the island from the result.
- **Leaving an optimistic overlay up.** Pass the promise to `set` or `update`.
- **Forms without `method="post"`.** Actions only run for POST.
- **Throwing for validation errors** renders the `error` page. Return `fail(400, data)`.
- **Casting action data.** Pass `typeof actions`; annotate the parameter, not the export.
- **Disabling the Origin check.** Allow the origin with `lumiose({ csrf: { allowedOrigins } })`.

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.
- [LUM5004](../errors/LUM5004.md): head or status change inside a streamed boundary.

See also: [Server](server.md), [Routing](routing.md), [reference: app layer](../reference/app.md).
