---
id: TASK-152
title: Hydration adopts server nodes in place (no detach/re-insert)
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 05:35'
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
- [ ] #1 No server-rendered node is detached or re-inserted during hydration of slots and blocks (MutationObserver test); text nodes adopted; inline slot cloning lazy
- [ ] #2 Bench project-page LCP ≈ FCP (measured); dom/hydrate tests, islands-e2e, spa-router-e2e and sample suites green
<!-- AC:END -->
