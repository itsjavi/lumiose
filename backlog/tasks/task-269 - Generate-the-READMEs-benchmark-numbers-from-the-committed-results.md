---
id: TASK-269
title: Generate the README's benchmark numbers from the committed results
status: Done
assignee:
  - Lux
created_date: '2026-10-13 20:46'
updated_date: '2026-10-13 20:50'
labels: []
dependencies: []
ordinal: 271000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The root README shows the landing page's headline numbers and stack comparison table, copied by hand, so they drift when benchmark results are committed. Generate them from the same evidence()/stacks() modules the landing uses, between marker comments, with a check that fails when stale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README's headline numbers and comparison table are generated from apps/web/src/content evidence()/stacks() between <!-- generated:… --> markers
- [x] #2 pnpm readme:gen rewrites them; a content test fails with a fix hint when README.md is stale
- [x] #3 CONTRIBUTING.md says when to run it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (standalone): src/content/readme.ts renders the landing's headlines() and stack table (shared helpers headlines()/tableNote() moved to stacks.ts, page.stsx uses them; landing text verified unchanged in the dev server) as HTML between <!-- generated:proof|compare --> markers, HTML so oxfmt leaves it as generated. scripts/readme.ts loads it through Vite's runnerImport (evidence.ts needs ?raw and import.meta.glob); root 'pnpm readme:gen'. content.test.ts fails with 'run pnpm readme:gen' when stale. Not hooked into the three benchmark writers (other owners' areas): the test catches a stale README when results are committed. Checks: content tests 17/17, lumiose check, oxlint, oxfmt --check; README rendered through GitHub's Markdown API and screenshotted.
<!-- SECTION:NOTES:END -->
