---
id: TASK-406
title: Site a11y suite covers every UI page
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 22:29'
updated_date: '2026-10-16 00:21'
labels:
  - web
  - a11y
milestone: m-12
dependencies:
  - TASK-387
priority: low
ordinal: 405000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From batch 4 (2026-10-15): apps/web's e2e/a11y.e2e.ts lists the UI pages in PAGES and OPEN_DEMOS by hand. Halo's Field, Fieldset, Form, Input, Checkbox, Checkbox Group, Radio and Switch pages may be missing. Derive the list from packages/ui/docs (or check it against the docs), so new components are covered without an edit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every /ui page is in the site's axe suite, in light and dark, and a new docs page is picked up automatically
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, solo takeover in batch 6): done in 7e8345f4.

- apps/web/e2e/a11y.e2e.ts builds its UI page list from `packages/ui/docs/*.md`: the introduction first, then the rest by name, each named by its `# Title`. The list joins PAGES, so every check that loops over PAGES covers each /ui page: axe in light and dark, decorative contrast, reduced motion, ambient motion, 320px reflow and target sizes. That is 28 pages, up from 14, and a new docs page is picked up without an edit. A /ui page must answer 200, so a page missing from llms.txt cannot pass as the 404.
- OPEN_DEMOS (the popups opened before axe) stays hand-written, because each one needs its own interaction.
- The wider coverage found two issues:
  - /ui/toast at 320px with text spacing overflowed by 31px. The heading `Toast.createToastManager` (renamed in TASK-401) is one long word. DocArticle's prose headings (h2, h3) now wrap anywhere, as its inline code already did.
  - /ui/progress: the indeterminate bar's `lu-progress-slide` runs past 5s. The ambient-motion check (2.2.2) now skips animations on `progress:indeterminate`: an activity indicator whose motion tells that work goes on, and it stops under reduced motion (that check passes). Flagged for Lux and Halo in the report, in case they prefer another policy.
- Full run: 112 passed with 2 failures (the two above). After the fixes, both tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
apps/web's a11y suite reads the /ui pages from packages/ui/docs (28 pages, light and dark, plus reflow, motion and target checks); it found and fixed a 320px overflow on /ui/toast, and exempts the indeterminate progress bar from the 5s motion check as an activity indicator (7e8345f4). Checks: pnpm check (2295 tests), cargo fmt/clippy/test, pack:check --smoke --skip-npm, ui-e2e 519 passed (15 skipped), apps/web 159 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
