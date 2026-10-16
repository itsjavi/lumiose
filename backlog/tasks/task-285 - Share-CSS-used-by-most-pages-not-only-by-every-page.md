---
id: TASK-285
title: 'Share CSS used by most pages, not only by every page'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-16 23:04'
labels:
  - css
  - build
  - performance
dependencies: []
priority: medium
ordinal: 287000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 8. The merged shared stylesheet is the longest common prefix of every page's list (packages/vite/src/app/production/stylesheets.ts). One page without the site chrome (the port's fullscreen editor, outside a (site) route group) drops the header, footer and catalog CSS from the shared file, so each page's merged file repeats them: 38 CSS files and 207 kB on the port against Astro's 3 files and 45 kB, though each page still downloads less CSS than with Astro. Consider sharing by route group layout, or CSS used by most pages, and measure on the sample apps and the port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared CSS no longer depends on every page having the same prefix, or the measured trade-off is recorded and the current rule kept
- [x] #2 concepts/styles.md (In builds) matches the rule
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-17): claimed in worktree branch claude/nova-css-0fc0df.

Nova (2026-10-17), design and measurements.

Rule (build: `sharedRuns()` in packages/vite/src/app/production/stylesheets.ts; runtime: `sharedStylesheets()` in packages/lumiose/src/app/server/stylesheets.ts, which the build also uses to key each page's own tag, so both agree):
1. Shared file: the stylesheets every page starts with (unchanged).
2. Group file (new): the routes' distinct stylesheet lists are grouped by the stylesheet that follows the shared file. A group of 3 distinct lists or more gets one more shared file with the run all its lists continue with, when that run is over 4 kB (INLINE_LIMIT). A smaller run is pushed down: the group's subgroups are tried from the same point, and lists left out keep the run in their own CSS. One group file per page at most, so at most 3 stylesheet tags. `not-found`/`error` pages do not shape groups; they link the files their list starts with.
3. The page's own stylesheets: unchanged (inline up to 4 kB, else one merged file).
Cascade order: a page links a shared file only when its list holds every stylesheet of it at that point, so its tags hold exactly its list, in order (unit test over every page, build test with a (site) group).
`StyleTags` (server-entry JSON, internal) gains `groups`. No public option.

Measured (brotli; in-process A/B: main's styleTags/stylesheetTags against this branch's, on copies of each client output). Port = the itsjavi.com port's dist/client built with lumiose 0.4.0; each of its 39 pages' lists read from the HTML, 404 as other page. Fixture = a 40 kB Tailwind-like base, a (site) group of 5 routes (8 kB chrome), an (app) group of 4 (6 kB), a docs group of 2 (5 kB) and one editor page.

| App | Merged files | First view: req avg / max / kB avg | Visit to every page: req / kB |
| --- | --- | --- | --- |
| port, before | 12 (29.7 kB) | 1.87 / 2 / 4.37 | 12 / 29.2 |
| port, after | 7 (13.2 kB) | 2.64 / 3 / 4.67 | 8 / 15.3 |
| fixture, before | 12 (16.9 kB) | 1.92 / 2 / 7.93 | 12 / 22.5 |
| fixture, after | 2 (2.3 kB) | 1.92 / 2 / 7.99 | 5 / 14.3 |

apps/web, ssr-bookshelf, spa-chiptune, ssg-travel-journal, ui-e2e, ssr-styles-e2e, ssr-i18n-i18next and ssr-realtime: identical tags (same JSON) before and after.

Trade-off: a first view of a grouped page links one more file (port 1.87 → 2.64 requests on average, +0.3 kB as separate files compress a little worse), for half the bytes and a third fewer requests on a visit to every page. Pages outside every group link what they linked before.

Rejected (simulated over the same lists, unless noted):
- Groups of 2 lists (measured, A/B): the port gains the same; apps/web's two docs routes (/docs and the @lumiose/ui docs: combobox, DocsSearch, DocsShell, 6.9 kB raw) would link a third file on every docs page (1.36 → 1.55 requests on average) to save 0.3 kB on a visit to every page. Two lists save at most one download of the run.
- No cap on group levels: port 14.0 kB for a visit, but 3.23 requests on average and up to 4 on a first view.
- One shared file per page holding the group's whole prefix (document + chrome): port 1.72 requests on average and 18.5 kB, but it repeats the every-page CSS in each group's file: fixture 33.1 kB (47% more than before), apps/web 26.5 kB (16% more).
- Only a run most pages (over half the lists) continue with: the port gains the same, the fixture nothing (no group has a majority).
- Groups by route-group layout: the same runs whenever the lists diverge at a layout; the prefix tree also finds runs of shared components and needs only the lists.

Validation (Nova, 2026-10-17): pnpm check exit 0 (2535 Vitest tests, cargo); pnpm pack:check --smoke --skip-npm exit 0; Playwright: apps/web 179 passed (4 skipped), ssg-travel-journal 17, ssr-bookshelf 17, ssr-styles-e2e 10. New tests: packages/vite/src/app/production/stylesheets.test.ts (the split, cascade order of every page's tags), build.test.ts (a (site) group with a page outside it), packages/lumiose/src/app/server/stylesheets.test.ts (group links). Docs: concepts/styles.md (In builds), llms-full.txt regenerated. Commit d57d6bc2. No public option; output: grouped pages may link a second shared styles-*.css (at most 3 stylesheet tags per page).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared CSS no longer needs every page to have it: after the every-page shared file, a group of 3+ routes that continue with the same stylesheets (over 4 kB) gets a second shared file, linked by those pages only, in cascade order. On the itsjavi.com port a visit to all 39 pages went from 12 requests / 29.2 kB to 8 / 15.3 kB (brotli), for 0.8 more requests on a first view; the sample apps and apps/web build identical tags. Rejected alternatives and their numbers are in the notes.
<!-- SECTION:FINAL_SUMMARY:END -->
