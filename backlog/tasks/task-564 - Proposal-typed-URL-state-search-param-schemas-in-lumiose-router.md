---
id: TASK-564
title: 'Proposal: typed URL state (search param schemas) in lumiose/router'
status: To Do
assignee:
  - Lux
created_date: '2026-10-24 15:39'
labels:
  - proposal
dependencies: []
references:
  - packages/lumiose/src/app/router/search.ts
  - packages/lumiose/docs/reference/router.md
priority: low
ordinal: 556000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Typed URL state for `lumiose/router`: declare a page's search params once (types, defaults, arrays, enums, custom codecs), read them typed on the server and reactively in islands and SPAs, and write partial updates that drop defaults from the URL. Status: proposal, nothing implemented. Names and syntax need the user's approval (AGENTS.md).

## Problem

`searchParams()` and `searchParams.set()` (decision-61, TASK-525) give a reactive but untyped `URLSearchParams` and readable query strings. In real use (a product list with search, filters, a multi-column sort `sorts=price:desc,name:asc` and a grid/table view switch, rendered by a `server` page and driven by one island), the app needed about 80 lines of hand-written URL state in a shared module:

- one `parseState(query)` for both the server page and the island: an enum guard, integer and boolean parsing, a `.`-joined array, and a sort-list parser that rejects invalid entries, all falling back to defaults;
- `serializeSorting()`, plus a `setQuery(changes)` wrapper over `searchParams.set(fn, { shallow: true, replace })` that deletes keys set to `null`/`""` so defaults leave the URL (nuqs calls this `clearOnDefault`);
- sort links rendered by the server (`?…` hrefs built from the request query) so sorting works without JavaScript;
- a per-key switch: one key (the language) needs a page load, the others are shallow;
- a migration of retired keys (`sort` and `sortdir` became `sorts`).

Every app with list UI writes this again. The mistakes show up as hydration mismatches (the server and the island parse differently), defaults leaking into shared URLs, or `?page=abc` crashing.

## Prior art

| | Declare | Read | Write | Notes |
| --- | --- | --- | --- | --- |
| nuqs | Per-key parsers: `parseAsInteger.withDefault(1)`, `parseAsStringLiteral([…])`, `parseAsArrayOf(p, ",")`, `createParser({ parse, serialize, eq })` | `useQueryStates(parsers)` (React); on the server `createLoader` / `createSearchParamsCache`; `createSerializer` for hrefs | `set({ page: 2 })`, where `null` clears; options `history`, `shallow` (default true), `clearOnDefault` (default true), throttling, `urlKeys` | The closest fit. Invalid values fall back to the default. React only, about 6 kB gzipped. |
| TanStack Router | `validateSearch` on the route: a function or a Standard Schema (zod, valibot, ArkType) | `Route.useSearch()`, `loaderDeps` | `navigate({ search: (prev) => … })`, typed `<Link search>`; `stripSearchParams(defaults)` and `retainSearchParams` middlewares | Route-level types flow into links. JSON-style serialization by default (objects in the URL). Whole-object validation: one bad key fails the object unless each key has `.catch()` / `fallback()`. |
| SvelteKit | None (`url.searchParams` in `load`) | `page.url.searchParams` | `goto("?…", { replaceState, keepFocus, noScroll })`; shallow routing (`pushState`) keeps its state in `page.state`, not in the URL | The community `sveltekit-search-params` adds per-key codecs (`queryParam("page", ssp.number())`). |
| Remix / React Router | None (typegen types path params only) | `useSearchParams()`; loaders parse with zod (zodix-style helpers) | `setSearchParams((prev) => …, { replace, preventScrollReset })` | Untyped; parsing stays in userland. |
| Standard Schema | `~standard.validate(value)`, implemented by zod ≥ 3.24, valibot ≥ 1 and ArkType ≥ 2 | | | A types-only spec: you copy the interface, with no dependency. It only validates (no serializer), and validation may be async. |

What to take from them: per-key codecs (nuqs) give a fallback per key and know how to write each value. Route-level schemas (TanStack) give typed links. Plain form encoding (repeated keys, `on` for checkboxes) keeps `<form method="get">` working without JavaScript, which matters more to MPA-first Lumiose than JSON in URLs.

## Proposed API (names to be approved)

**Phase 1**, in `lumiose/router`, in its own module next to `search.ts` (tree-shaken):

```ts
// src/lib/product-search.ts: shared by the server page, the island and endpoints
import { param, searchState, type SearchValues } from "lumiose/router";

const SORT_KEYS = ["name", "price", "rating"] as const;
type Sort = { key: (typeof SORT_KEYS)[number]; dir: "asc" | "desc" };

const sort = param.codec<Sort>({
  parse(raw) {
    const [key, dir, extra] = raw.split(":");
    const valid = SORT_KEYS.includes(key as Sort["key"]) && (dir === "asc" || dir === "desc");
    return valid && extra === undefined ? { key: key as Sort["key"], dir } : null; // null: invalid
  },
  serialize: (s) => `${s.key}:${s.dir}`,
});

export const productSearch = searchState({
  q: param.string().default(""),
  page: param.integer().default(1),
  inStock: param.boolean().default(false),
  view: param.enum(["grid", "table"]).default("grid"),
  tags: param.array(param.string()), // ?tags=a&tags=b, default []
  sorts: param.array(sort, { separator: "," }), // ?sorts=price:desc,name:asc
});

export type ProductSearch = SearchValues<typeof productSearch>;
// { q: string; page: number; inStock: boolean; view: "grid" | "table"; tags: string[]; sorts: Sort[] }
```

Server page (`server` mode); an endpoint calls `productSearch.parse(ctx.url.searchParams)`:

```tsx
export const mode = "server";

export default function Products() {
  const search = productSearch(); // the request's query, typed
  const rows = sortRows(filterRows(all, search), search.sorts);
  return (
    <ProductList client:load total={all.length}>
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              // "?view=table&sorts=price:asc": other params kept, defaults dropped, works without JS
              <th><a href={productSearch.href({ sorts: cycleSort(search.sorts, column.key) })}>{column.label}</a></th>
            ))}
          </tr>
        </thead>
        …
      </table>
    </ProductList>
  );
}
```

Island, or SPA page, using the same module:

```tsx
export function ProductList(props: { total: number; children?: JSX.Element }) {
  return (
    <>
      <input
        type="search"
        value={productSearch().q}
        onInput={(event) =>
          productSearch.set({ q: event.currentTarget.value, page: null }, { shallow: true, replace: true })
        }
      />
      <ViewSwitch value={productSearch().view} onChange={(view) => productSearch.set({ view }, { shallow: true })} />
      <button onClick={() => productSearch.set({ q: null, tags: null, inStock: null }, { shallow: true })}>
        Clear filters
      </button>
      {props.children}
    </>
  );
}
```

Semantics:

- `productSearch()` is reactive and reads what `searchParams()` reads: the request on the server (`= productSearch.parse(url().searchParams)`), the document's query in islands, the router's in SPAs. At build time a `static` page has no query (LUM5001), as with `searchParams()`.
- `.set(partial | (current) => partial, options)` changes only the given keys. `null` resets a key (the key is removed); `undefined` leaves it as it is; a value that serializes like the default is removed. Params the schema does not know (another island's, `utm_*`) stay as they are. `options` are `SearchParamsOptions` (`shallow`, `replace`), with the decision-61 default: a page load unless `shallow`. `searchState(shape, { shallow: true, replace: true })` sets defaults for the schema. A key can force a page load, `param.enum(LANGS).default("en").options({ shallow: false })` (nuqs `withOptions`), whenever a write includes it. The function form receives the typed current values, pending writes included. On the server `set()` throws, as `searchParams.set()` does.
- Writes in the same microtask merge into one history entry: several controls, or two islands with their own schemas.
- `.parse(query)`, `.serialize(values, base?)` and `.href(values)` are pure and run anywhere. `href()` applies `values` to the current query (request, document or router) and returns `?…`, as readable as what `searchParams.set()` writes (TASK-525).
- Standard Schema per key, with no dependency: any value with `~standard` works as a codec. It receives the raw string, or `undefined` when the key is missing, and its output is the value. Its default is what it returns for `undefined` (`z.coerce.number().int().min(1).default(1)`, `v.optional(…, 1)`); a failed validation falls back to that default. Writes use `String(value)` unless wrapped as `param.from(schema, { serialize })`; `param.array(schema)` makes a list. Async validation throws. Pitfall for the docs: `z.coerce.boolean()` reads `"false"` as true; use `param.boolean()` or `z.stringbool()`.

**Phase 2, optional, with its own decision.** A route declares its schema next to its params, `export { productSearch as search } from "../../lib/product-search.ts"` in `page.tsx`, and typegen adds `search` to `RouteMap`. That types the `search` of `PageProps<"/products">`, plus a search argument of `href()` and `<Link>`; the shape is to be decided and must not clash with a param named `search`. Costs: typegen must read the type of a page module's export (which works for `.tsx`, but `.stsx` needs the shadow typing), and the schema still has to live in a shared module, because islands cannot import page modules. The problem above does not need it: revisit once Phase 1 has users.

## Edge cases

- **Invalid values.** Handled per key and never thrown: the key falls back to its default (`null` when it has none). An array with an invalid item is invalid as a whole, which is what a sort list wants; keeping the valid items instead is an option to decide. Reading never writes, so invalid values stay in the URL until that key is written, and a page load adds no history entry. Recipe for a canonical redirect: `productSearch.serialize(productSearch.parse(q), q)` compared with `q`.
- **Unknown params** are ignored on read and kept on write. `searchState(shape, { remove: ["sort", "sortdir"] })` drops retired keys on every write. Reading a legacy key into a new one stays in userland, as a wrapper around `parse`.
- **Scalars.** When a scalar key repeats, the first value wins (`URLSearchParams.get`). `?page=01` reads as 1. `?q=` equals the default `""`.
- **Arrays.** Repeated keys by default (`?tag=a&tag=b`, which is what `<form method="get">` checkboxes send). A single item, `?tag=a`, reads as `["a"]`, because the key is declared as an array. Empty items are dropped, and `[]` (the default) removes the key. With `separator`: `?tags=a` reads as `["a"]`, `?tags=` reads as `[]`, and an item that contains the separator is escaped.
- **Booleans** read `true`, `false`, and `on` (a checked checkbox). With the default `false`, only `?inStock=true` is ever written.
- **Key order.** An existing key keeps its position and a new key is appended, so the URL stays stable while the user edits.
- **Reactivity.** One computed per schema, recomputed only when one of its own raw keys changes. Unchanged keys keep their previous value (the same array or object), so a `computed` that depends on `sorts` does not re-run when `q` changes.
- **History rate limits.** Browsers rate-limit `pushState`/`replaceState` (Safari throws after about 100 calls in 30 s). Merging per microtask helps; for text inputs the app should also use `replace: true` and a debounce. A `throttle` option can follow if needed.
- **Security.** Values are untrusted input, and codecs never evaluate them. Core ships no JSON codec; a `param.codec` with a Standard Schema covers it where wanted.

## SSR and hydration

The server page and the island's SSR parse the same request query with the same schema, and the client parses `location.search` of that same URL. The markup matches, and no state is serialized into the HTML. After a shallow write, the server-rendered parts keep the HTML of their URL (decision-61), so islands own the query-dependent UI. `static` pages: use `client:only`, or read after mount. In SPAs, `set()` navigates through the router, and `shallow` changes nothing.

## Bundle size

Measured on a throwaway prototype (esbuild, min+gzip, outside the repository): a schema with string, integer, enum and array codecs adds about 0.8 kB, and every codec plus the Standard Schema adapter about 1.0 kB. That comes on top of `search.ts` (about 0.65 kB, already shipped by islands that use `searchParams`) and the signals core. Apps that do not import it pay nothing. nuqs is about 6 kB gzipped. A zod or valibot schema adds that library's own size to the island, which is why native codecs come first.

## Alternatives

1. **Docs recipe only:** a "URL state" guide with a shared parse/serialize module and `searchParams.set(fn, { shallow: true })`. No bytes and no API, but every app writes defaults, arrays, merging and escaping again, and keeping the server and the island in step is up to the user.
2. **Userland helper** (or a separate `@lumiose/search` package): the same code without a router API. It cannot reach router internals (per-key subscriptions, merging writes with the router's `set`), and it cannot feed typegen later.
3. **Whole-object Standard Schema only** (TanStack-style `validateSearch`): reuses zod schemas, but needs a validation library in every island, loses the per-key fallback, and still needs serializers to write.
4. **Route-level schemas only** (Phase 2 without Phase 1): typed links, but on MPA pages this state belongs to islands, which still need a shared module. It is also tied to typegen.

## Recommendation

Phase 1: `searchState(shape, options?)` with `param.*` codecs and per-key Standard Schema, in `lumiose/router`, built on `readSearchParams`/`writeSearchParams` so that the SPA, MPA, shallow and server rules of decision-61 hold unchanged. It is small, MPA-first (form-compatible encoding) and has no dependency, and one declaration replaces the hand-written module in the example above. Phase 2 waits for its own decision.

For the user to decide:

- the names: `searchState`, `param`, `.default()`, `.options()`; alternatives are `searchParams.schema()` or nuqs-style `parseAs*`;
- the default array encoding (repeated keys proposed);
- `null` resets a key while `undefined` leaves it;
- whether an invalid array item invalidates the whole array.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user chose an API (or declined), recorded in a decision
<!-- AC:END -->
