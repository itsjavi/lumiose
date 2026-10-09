---
id: TASK-140
title: 'LUM2006 false positive: index reads over constant arrays'
status: Done
assignee:
  - Photon
created_date: '2026-10-09 05:10'
updated_date: '2026-10-09 05:14'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 140000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-133 (Chime): CHANNELS.map((info, i) => { const ch = i … }) over a module-level constant array whose rows never move warns LUM2006. The index of a constant, never-reordered source is stable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No LUM2006 when the list source is a module-level const array literal (or as const) that is never mutated; reactive sources still warn; golden/test; LUM2006 docs mention it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): analyze computes Analysis.constant_arrays: top-level `const X = [...]` (also exported; `as const` is stripped first) never reassigned and never written through (X[i] = / X.length = / ++ / delete / push, pop, shift, unshift, splice, sort, reverse, fill, copyWithin). compile_list skips the LUM2006 check when the .map source is such an identifier (the index is still compiled to i(), read once, which is stable there). Reactive sources and mutated arrays still warn. Test compile_api stable_list_sources_keep_the_index_without_lum2006; docs errors/LUM2006.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No LUM2006 for .map over a never-mutated module-level const array literal; reactive or mutated sources still warn; test + docs.
<!-- SECTION:FINAL_SUMMARY:END -->
