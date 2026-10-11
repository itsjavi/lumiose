---
id: TASK-206
title: 'js-framework-benchmark: add Vue and Preact entries'
status: In Progress
assignee:
  - Spark
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 02:18'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the stack table's Vue + Nuxt and Preact rows need client speed and size. Add krausest's keyed Vue (standard, not Vapor) and Preact entries to pnpm bench:jsfb, at current versions, and rerun.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm bench:jsfb runs Vue (non-Vapor) and Preact keyed entries with pinned versions
- [ ] #2 RESULTS.md includes both, with published factors where krausest has them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): implemented. scripts/jsfb.ts adds krausest's keyed vue (standard, non-Vapor) and preact-hooks entries to REFERENCE (an existing .krausest checkout re-applies its sparse list, so they appear without a fresh clone). Versions are the latest stable (decision-41, TASK-225): vue 3.5.43, preact 11.0.1, installed exactly over krausest's lockfiles (PINNED in jsfb.ts). Both build and passed a smoke run of every benchmark (pnpm bench:jsfb --count 1 --mem-count 1, all 11 entries, no errors; RESULTS.md restored afterwards, not regenerated). Smoke numbers are noisy (busy machine) and not recorded.
Remaining: only the quiet-machine run that regenerates RESULTS.md (AC #2): pnpm bench:jsfb --count 10 --mem-count 3, about 1.5-2.5 h for 11 entries. Then the website's evidence (apps/web/src/content/evidence.ts, Beacon) can use the new columns.
<!-- SECTION:NOTES:END -->
