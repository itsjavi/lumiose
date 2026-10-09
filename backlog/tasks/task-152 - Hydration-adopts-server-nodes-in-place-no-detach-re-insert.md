---
id: TASK-152
title: Hydration adopts server nodes in place (no detach/re-insert)
status: Done
assignee:
  - Spark
created_date: '2026-10-09 05:35'
updated_date: '2026-10-09 05:42'
labels:
  - hydration
  - perf
dependencies: []
priority: medium
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-136 (Prism): on the bench project page, hydration detaches and re-inserts the server-rendered table, so Chrome re-reports LCP after hydration (Lumen ~208 ms vs ~140 ms for the React apps; LCP = FCP without island JS). Two moves: (1) slot() in dom/hydrate.ts (~328) returns slot nodes and reconcile in dom/insert.ts (~176) replaceChild(TABLE, <!--l:s:children-->) — prototype: adopt the slot nodes into the hole in place (x.splice(x.i, 1, ...nodes)); (2) hydrate.ts ~147–155 moves '[' block content that precedes a template node into a fragment (h.d) and re-inserts it in region() (~248) — needs adopted nodes to stay in place and the compiled firstChild/nextSibling walk to skip them (or walk claimed references; Photon for codegen if needed). Also: adopt the text node instead of replacing it (selected-count '0'); clone inline slots lazily instead of cloneNode(true) per hydration (~384). Coordinate with Photon's TASK-144 (hydration regression) — start after it lands or after checking its notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No server-rendered node is detached or re-inserted during hydration of slots and blocks (MutationObserver test); text nodes adopted; inline slot cloning lazy
- [x] #2 Bench project-page LCP ≈ FCP (measured); dom/hydrate tests, islands-e2e, spa-router-e2e and sample suites green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: no codegen change needed. (1) Blocks before a template node stay in place: walk() redirects the one link the compiled firstChild/nextSibling walk takes into the block (an own firstChild/nextSibling property on the parent or the preceding aligned node, pointing at the next aligned server node) until the block's region opens (region() deletes it; hydrate() clears any leftovers after the sync pass). (2) slot() adopts the inline slot nodes into the region's hole in place (Prism's prototype), so reconcile moves nothing. (3) Text: the '0' text moves came from (1); text values are adopted as before. (4) Inline slots are no longer cloned per hydration: their nodes are recorded and copied on first use (the copy is made from the live nodes then). Test: hydrate.test.ts 'moves no server node while it adopts slots, blocks and text (TASK-152)' (MutationObserver: only marker comments and empty range texts change; fails on HEAD with TABLE/I/#text moves); insert-text.test.ts walks like compiled code. Bench /projects/api (4x CPU throttle, 5 runs): before FCP 116-136 ms with a second LCP entry at 156-180 ms (td after hydration); after a single LCP entry = FCP (112-168 ms). Validation: lumen dom+app vitest green (2 unrelated failures from Halo's csp WIP in server/contract and cli tests), typecheck, oxlint; Playwright islands-e2e 5, spa-router-e2e 22, bookshelf 15, travel journal 17, chiptune 20. Also fixed vite-counter's style-HMR test (its source.replace string predated TASK-124's lumen fmt): 9/9.
<!-- SECTION:NOTES:END -->
