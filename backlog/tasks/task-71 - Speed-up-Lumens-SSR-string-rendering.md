---
id: TASK-71
title: Speed up Lumen's SSR string rendering
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 16:26'
labels: []
milestone: m-3
dependencies: []
priority: medium
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The SSR benchmark (TASK-20, benchmarks/ssr/RESULTS.md) renders the 1,000-row page at ~340 renders/s: 2.1x slower than Solid (~700) and 1.5x slower than Svelte (~520), ahead of Vue and React. A CPU profile of the Lumen run (node --cpu-prof scripts/run.ts lumen) shows ~36% of the time in escaping (packages/lumen/src/server/node.ts escapeText/escapeAttr: regex test + replace with a callback per match), ~7% in class serialization (server/attrs.ts classString/addTokens: split(/\s+/) and includes() dedupe for every element), ~13% GC, then list/ssr/runComponent. Candidates: a char-code escaping loop that slices unchanged runs; escaping only what HTML requires (& and < in text, & and " in double-quoted attributes; Solid and Svelte do this) if client/server parity allows; a fast path or cache for plain-string classes; fewer allocations per component frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lumen renders the benchmark page at least 1.5x faster than in the TASK-20 baseline on the same machine, with the server parity and golden tests green
- [ ] #2 benchmarks/ssr/RESULTS.md regenerated with the new numbers
<!-- AC:END -->
