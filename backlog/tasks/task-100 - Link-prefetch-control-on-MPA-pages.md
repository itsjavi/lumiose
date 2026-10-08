---
id: TASK-100
title: Link prefetch control on MPA pages
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:52'
updated_date: '2026-10-08 22:11'
labels: []
milestone: m-3
dependencies:
  - TASK-93
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-24 amendment) that <Link prefetch> is the per-link prefetch control everywhere: on MPA pages it renders a plain <a> that the generated speculation rules include or exclude (none/hover/viewport).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 <Link> works outside SPA subtrees (no client router code shipped there), rendering <a> with a marker the speculation rules use: prefetch=none excluded, viewport eager, hover moderate; plain <a> follows the project default
- [x] #2 Tests (Chromium prefetch behaviour) and docs (routing, reference/router) in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server <Link> (router/index.server.ts) and client <Link> (router/link.ts) render the per-link marker data-l-prefetch="none|hover|viewport" when prefetch is set; no prop = plain <a> = project default.
2. Speculation rules (app/server/navigation.ts): when the page has marked links, partition links by level: the default level's rule excludes links marked with another level, and each other level gets its own selector_matches rule (hover → moderate, viewport → eager, none → no rule). Pages without marked links keep TASK-93's rules byte for byte.
3. Handler: detect marked links by the marker in the shell; streamed pages assume marked links for hover/viewport defaults; with prefetch: "none", rules for marked links found only in streamed boundaries are appended before </body>.
4. No client router code on MPA pages: Link outside islands is server-only; in MPA islands, keep router.ts tree-shaken (mark lumen/router's search object pure).
5. Tests: navigation unit tests, server Link test, a Chromium check of prefetch behaviour; docs routing, reference/router, reference/vite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-20261008T215800Z):
- Marker: server <Link> (router/index.server.ts) and client <Link> (router/link.ts) render data-l-prefetch="<level>" when prefetch is set; no prop = plain <a> = project default. Outside islands <Link> is server-only (no JS); in MPA islands, lumen/router's search object is now /* @__PURE__ */, so an island using only <Link> ships none of the router (scratch build: island chunk 5020 → 4245 B, no navigate/search code; only Link's aria-current check remains).
- Rules (app/server/navigation.ts documentRules): pages without marked links keep TASK-93's rules byte for byte; with marked links (found in the shell), the default level's rule adds not selector_matches '[data-l-prefetch]:not([data-l-prefetch=<default>])' and each other level gets selector_matches '[data-l-prefetch=<level>]' (hover → moderate, viewport → eager, none → no rule). Streamed pages: hover/viewport defaults get the marked rules in the head; prefetch: "none" appends the rules after the stream once a streamed boundary has a marked link (no rules otherwise, so no CSP noise for none users).
- Finding: Chromium 153 desktop treats eager as a brief hover (~10 ms), not viewport entry (mobile uses viewport heuristics); documented in reference/vite. Browsers prefetch by URL: a none link to a URL another link prefetches gets it anyway (documented).
- Spark's dir: minimal edits in link.ts, index.ts, index.server.ts, server.test.ts (expectation gains the marker).
- Evidence: navigation.test.ts per-link suite (3 tests: grouping, none default, streamed boundaries); journal e2e '<Link prefetch> sets a link's prefetch apart from the default' (Chromium: none never prefetched on a 500 ms rest; plain link not on a 40 ms pass; viewport link prefetched on it), stable 4/4; full journal e2e 16/16; pnpm test 1014 passed; pnpm typecheck clean; oxlint clean on my files (the only lint error is in Spark's untracked scripts/size-apps.ts).
- Sample: the travel journal pager uses <Link prefetch="viewport"> for Newer/Older and prefetch="none" for page numbers (class carries the scope; pager unchanged visually).
- Docs: concepts/routing, reference/router, reference/vite, journal README; llms-full regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
<Link prefetch> works on MPA pages: it renders a plain <a> with a data-l-prefetch marker (no client router code), and the page's speculation rules group marked links by level (none excluded, hover moderate, viewport eager) while plain links follow lumen({ prefetch }). Pages without marked links keep the previous rules; with prefetch: "none" only pages with marked links get rules. Covered by unit tests and a Chromium e2e in the travel journal; docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
