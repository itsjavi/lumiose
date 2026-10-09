---
id: TASK-112
title: 'Fullstack bench: Lumen SSR app'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 04:37'
labels:
  - benchmark
milestone: m-8
dependencies:
  - TASK-110
priority: medium
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-4: the Tracker app in Lumen (route mode server, async components + Suspense for comments, form actions, islands for bulk select, comment composer, label picker and search box).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Passes the conformance suite in production mode
- [ ] #2 Idiomatic Lumen; framework friction found while building it is recorded as notes or new tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: app at benchmarks/fullstack/apps/lumen (@bench/app-lumen): mode server in the root _layout; pages are server components calling @bench/data through src/server/data.ts; comments = async component inside <Suspense> (streams, verified with COMMENTS_DELAY_MS); actions: status/comment (named, redirect back), new issue (default action, fail() re-render), login/logout (action + POST endpoint), bulk close (named action posted by the island to '<list URL>&/close', redirects back to the filtered list); islands (all client:load): BulkSelect (the 50-row table is a server slot, so rows ship no JS/data), CommentComposer (submit + bind:value), LabelPicker, SearchBox (fetchJSON, debounced). __benchReady: islands call markReady() on mount; island-less pages render an inline <script>. Conformance: 15/15 pass in production. Rendered DOM diffed against the React Router app: identical apart from React's split text nodes, framework form action URLs and RR's data-discover.
FRICTION found: (1) LUM2001 false positive on `x ?? notFound()` in server pages, and on zero-arg calls of workspace data functions unless re-exported from src/server/ -> TASK-135 (Photon). (2) LUM2003/LUM2001 flag plain prop reads in components that only ever render on the server (`if (!props.error) return null`, `const { values } = props`): by design since any component may become an island, but noisy for server-only UI; rewrote as ternaries. (3) lumen check reported TS2589 'type instantiation excessively deep' on 4 files on the first two runs, then never again (no code change): a flaky TS 7 + Lumen JSX types interaction, not reproduced since. (4) Docs gap: named actions keep the other query params (`?status=open&/close`, ctx.url has them) but data-and-actions.md only documents `?/name`; and routing.md does not say that the root _404 renders inside the root _layout (the bookshelf example's _404 renders its own header because of route groups). (5) Dev: one file save sends two full-reload messages (double reload). (6) MPA invalidate() is location.reload(), which lets Chrome restore form state (submitted text/checkboxes) — moot after the decision-20 revision (TASK-118), but TASK-118 should keep in mind that the submitted form must end up reset.
<!-- SECTION:NOTES:END -->
