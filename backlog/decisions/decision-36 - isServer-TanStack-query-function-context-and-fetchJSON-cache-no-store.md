---
id: decision-36
title: 'isServer, TanStack query function context and fetchJSON cache no-store'
date: '2026-10-10 20:12'
status: accepted
---
## Context

TASK-193 and TASK-195 raised four DX questions. First, a `defineState` factory also runs in the browser, so reading request APIs there needs a guard. The user wanted the guard to stay explicit but found `import.meta.env.SSR ? … : …` too verbose. The other three came from the keyed cache: whether `query` functions should get TanStack's context, whether a component-level GET `fetchJSON` can skip the cache, and whether cache times should be tunable per call. The user answered all four on 2026-10-10.

## Decision

- **`isServer`:** `lumiose` exports `isServer`, Solid's name from `solid-js/web`. It is `true` on the server and `false` in the browser. It is a constant the bundler folds, so server branches disappear from client bundles. Factory guards read `signal(isServer ? locals().user : null)`. The guard stays explicit: request APIs still throw `LUM4003` in the browser.
- **Query function context:** `query(key, fn)` calls `fn({ signal, queryKey })`, matching TanStack's `QueryFunctionContext`. `signal` is the shared request's signal, the same one `getAbortSignal()` returns inside `fn`.
- **Cache opt-out:** a GET `fetchJSON(url, { cache: "no-store" })` bypasses the component cache. It makes a plain request: not deduped and not sent in the page payload. This uses the standard `RequestInit` option, as Next.js does.
- **Cache times:** per-call `staleTime`/`gcTime` are not offered for now. TanStack's defaults apply (`staleTime: 0`, `gcTime: 5 min`), and `@lumiose/query` covers advanced tuning.

## Consequences

- TASK-199 implements the first three; the docs and the factory LUM4003 hint use `isServer`.
- Per-call cache times can be added later with TanStack's option names if real apps need them.
