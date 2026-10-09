---
id: TASK-151
title: Evaluate server-side props at most once per component instance (decision-28)
status: Done
assignee:
  - Nova
created_date: '2026-10-09 05:35'
updated_date: '2026-10-09 05:44'
labels:
  - perf
  - server
  - contract
milestone: m-8
dependencies: []
priority: medium
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-28: on the server, dynamic props are evaluated lazily at most once per instance (first read caches); client props stay reactive; TASK-78's eager path stays. Implement in the server runtime's createComponent (Nova's area) or in server codegen (Photon) — measure the overhead of a runtime wrapper vs codegen and pick the cheaper; coordinate with Photon through task notes if codegen is needed. The fullstack bench app's FilterFields labels query should drop from 16 to 1 per /projects request without app changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server props evaluate at most once per instance; unread props never evaluate; parity tests and an SSR test counting evaluations
- [x] #2 doc-2 §1 note (Lux) and docs on props updated; /projects req/s before/after recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: implemented in server codegen (crates/lumen_compiler/src/codegen/client/components.rs, Photon's area; Photon is on TASK-142 in other files of the crate, so no overlap; FYI Photon). Measured first (node microbenchmark, 2 getter props read 1-2x, ns per component call): baseline getters 263; runtime wrapper in createComponent (scan descriptors, self-caching getters) 994 (+730, and +58 even for props without getters); codegen with Object.defineProperty self-replacing getters 473; codegen with symbol fields 346; codegen closure variables via an arrow wrapper 319 (+56, only on components with getter props). Chosen: the closure wrapper, server target only: createComponent(C, ((_d, _v) => ({ get p() { return _d ? _v : (_v = expr, _d = true, _v); } }))()); JSX-valued props and children included (a children read twice renders once); a throwing first evaluation is retried on the next read; client output unchanged (reactive getters). Islands' server props benefit too (serialization + render read once). Tests: server goldens updated (8 fixtures), new packages/lumen/src/server/props-once.test.ts (real compiler output: value/children/rows/labels each evaluated once per instance, unread prop never; client/server HTML parity; client still re-reads). /projects/api?page=3 req/s, bench Lumen app, interleaved 4 rounds × 5 s, same window (machine busy with other agents): before best 425 / median 420, after best 766 / median 617 (+47% median). Docs: concepts/components.md (props on the server). doc-2 §1 note left for Lux per AC.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server props evaluate lazily, at most once per component instance, via codegen closures (cheapest of the measured options); goldens, an SSR counting test and client parity test; /projects req/s median 420 -> 617 in an interleaved run; components.md updated.
<!-- SECTION:FINAL_SUMMARY:END -->
