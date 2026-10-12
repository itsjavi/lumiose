---
id: TASK-247
title: 'useId(): unique ids that match between server render and hydration'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 19:58'
labels:
  - runtime
  - api
milestone: m-9
dependencies: []
priority: high
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-43. useId() from lumiose: server id from the component instance's render-tree position; in islands, island id + island-relative instance path; hydration reuses it; client-only renders use a counter; a prefix option for several apps on one page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 useId() returns the same id on the server and after hydration, also inside islands and nested components
- [x] #2 Client-only renders get unique ids; a prefix option separates apps on one page
- [x] #3 Docs (reference/reactivity, an accessible-form example) and tests, including server/client parity
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user approved an idPrefix option on mount()/hydrate() and on the SSR render entry. Spark may edit the server render files under packages/lumiose/src/server/** that useId needs (coordinate: Nova works in app/** meanwhile).

Spark 2026-10-12: started (session spark-20261012T193258Z-t247).

Spark 2026-10-12, implementation:
- Client (dom/id.ts): while an island hydrates, useId() reads the hydration frame: `<idPrefix>l<islandId>-<instance path with . -> ->-<n>`, where n is the instance's next child index (frame.children++), so ids and child instance paths share one numbering on both sides. Frames carry the island id base (Frame.i, set by hydrate() from the <!--l:ID--> marker plus idPrefix). Without a frame (browser-only content, render(), after hydration): `<prefix>lc<counter>`, the prefix read from the root owner's context (ID_PREFIX).
- Server (server/id.ts): inside islands the same formula from the server instance frame (paths already match hydration for await replay). Outside islands `<prefix>ls<scope><n>`: frame.children counts ids, and code that runs later (async component runs, promise content, ErrorBoundary fallbacks) gets a forked scope numbered synchronously (frame.ts scope()), so ids do not depend on promise settle order (test: same HTML for two async siblings resolving in either order). Suspense keeps sharing its frame numbering as before.
- idPrefix (user-approved name): render(code, container, { idPrefix }) (RenderOptions; lumiose has no mount(), render() is the client root entry), renderToStream/renderToString({ idPrefix }); island records carry idPrefix (omitted when empty) and the loader passes it to hydrate(…, idPrefix); the CSR SPA entry (app/router/csr.ts) reads it too.
- No compiler/SSR codegen change needed: useId is a plain runtime import, resolved per condition.
- Size (Lux decision, option b): the 10 kB every-export cap had 18 B left; useId + render options add ~50 B, so the browser stubs of renderToStream/renderToString (throw-only, ~163 B incl. LumioseError) moved from dom/public.ts to app/server/browser.ts next to the other server-only stubs (exported via app/public.ts; the server exports moved to app/public.server.ts to keep the app-layer name parity). Brotli: every export 10222 -> 10124 B; typical 6181 -> 6239 B; typical+islands 9249 -> 9358 B; benchmark imports 5246 -> 5274 B; loader 0.96 -> 1.01 kB (soft target 1.00, reported only).
- Follow-up: the dev HMR wrapper in packages/vite/src/index.ts drops render()'s options (Photon's area): new task created.

Spark 2026-10-12, evidence: src/dom/id.test.ts 8/8 (island parity for nested components, children and async components after await replay; browser-only counter ids after hydration; idPrefix carried by the island record; server ids outside islands identical whichever async sibling resolves first; streamed Suspense + async ErrorBoundary fallbacks unique, which fails without the fallback scope; render() idPrefix; server useId() outside a render throws). lumiose package 884/884; examples/islands-e2e Playwright 5/5; spa-router-e2e 25/26, where the one failure (<Link> prefetch in the build project expects a chunk named 'slow') comes from TASK-253's in-progress route renames (slow.tsx -> slow/page.tsx). Docs examples type-check (cli examples.test) green; docs:check green. pnpm check: typecheck and lint OK; fmt:examples fails on spa-dotmatrix/learn/page.stsx (TASK-253); pnpm test has 4 failures outside this task (create templates: TASK-253 renames; cli docs links/llms: TASK-249 deploy pages in progress); scripts tests 31/31; size OK (every export 9.89 kB).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
useId() from lumiose: the same ids on the server and after hydration (island id + instance path inside islands, render-tree scopes elsewhere, independent of async order), a counter for browser-only content, and idPrefix on render(), renderToStream()/renderToString() (carried to islands through their records). To fit the 10 kB every-export cap, the browser stubs of renderToStream/renderToString moved to the app layer's server-only stubs (Lux, option b). Docs: reference/reactivity (useId with an accessible-form example), reference/dom, reference/server, concepts/components, coming-from-react. Follow-up TASK-257 (Photon): the dev HMR entry wrapper drops render()'s options.
<!-- SECTION:FINAL_SUMMARY:END -->
