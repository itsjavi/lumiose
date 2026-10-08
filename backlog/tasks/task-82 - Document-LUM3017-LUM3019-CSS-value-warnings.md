---
id: TASK-82
title: Document LUM3017-LUM3019 CSS value warnings
status: Done
assignee:
  - Beacon
created_date: '2026-10-08 20:48'
updated_date: '2026-10-08 21:17'
labels: []
milestone: m-5
dependencies:
  - TASK-81
references:
  - crates/lumen_css/tests/fixtures/values.out
priority: low
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
lumen_css warns about CSS values browsers would drop (TASK-76, TASK-67). Messages, help and fixes are shown in crates/lumen_css/tests/fixtures/values.out. LUM3017: a declaration value that does not parse for its property (Lightning CSS keeps it as written, the browser drops it), including grid track lists mixing repeat(auto-fill|auto-fit, ...) with non-fixed tracks; conservative: valid newer CSS Lightning CSS does not parse yet (var(), anchor(), if(), color-mix(), allow-discrete, subgrid, ...) is never reported. LUM3018: a numeric $ constant where a length/angle/time is required (gap: $gap; Lightning CSS turns unitless lengths into px but that is implicit/invalid CSS; angles and times are dropped) -> fix calc($gap * 1px), or $gap * 1px inside a math function; time gets help only (ms or s). LUM3019: '$gap px' (whitespace before the unit) -> fix calc($gap * 1px).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/lumen/docs/errors/LUM3017.md, LUM3018.md, LUM3019.md in the existing error-page format (what, why, fix, examples), linked from the errors README
- [x] #2 The styles docs ($ constants section) recommend unit-carrying constants or calc($x * 1px); llms.txt / llms-full.txt regenerated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-08, TASK-81 commit 0a0e469): wrote docs/errors/LUM3017.md, LUM3018.md, LUM3019.md (what, why, example, fix, related), linked from the generated errors README; llms.txt/llms-full.txt regenerated (AC#1 done). Left for AC#2: concepts/styles.md 'How values are written' already recommends calc($gap * 1px) and unit-carrying constants; it only needs links to LUM3018/LUM3019 once Halo's lumen_css change lands (the warnings are not emitted at HEAD yet).

Beacon (during TASK-89): AC #1 — LUM3017/3018/3019 pages already exist in the error-page format and are linked from errors/README (added with the registry in 0a0e469). AC #2 — concepts/styles.md 'How values are written' now recommends unit-carrying constants or calc($x * 1px) and names LUM3018/LUM3019; Common mistakes cover both; Related diagnostics list LUM3017–3019; llms regenerated (commit 0059f43). Caveat: the lumen_css side that emits these warnings (crates/lumen_css/src/values.rs) was still uncommitted in Halo's working tree at the time, and panicked on an empty value (reported on TASK-76).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM3017–3019 are documented: error pages plus the styles concept's $ value rules and common mistakes.
<!-- SECTION:FINAL_SUMMARY:END -->
