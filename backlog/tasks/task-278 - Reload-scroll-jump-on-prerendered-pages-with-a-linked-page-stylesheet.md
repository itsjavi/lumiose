---
id: TASK-278
title: Reload scroll jump on prerendered pages with a linked page stylesheet
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-15 12:36'
labels:
  - bug
  - css
  - build
dependencies: []
priority: high
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 1. Reloading a scrolled MPA page paints its first frames at the wrong position, then jumps; the user also sees it in other Lumiose projects. Measured with the port's scripts/reload-scroll.ts (30 reloads of / at scrollY 1400, Chromium): Astro 13/30 (1304 → 1400), Lumiose 18/30 (1596, the page end → 1400), Lumiose with its stylesheets inlined 0/30. Moving the island loader after the stylesheets, removing the speculation rules or the View Transitions style changed nothing. Cause: Chrome restores the scroll position early during a reload, from a layout made with the stylesheets loaded so far, and corrects it at load. A page's own CSS over INLINE_LIMIT (4 kB, packages/vite/src/app/production/stylesheets.ts) is linked as a file, so that early layout is the unstyled page. Likely fix: inline a page's own stylesheets whatever their size and keep only the shared prefix as a cached file (or raise the limit), after measuring the bytes on the sample apps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reloading a long, scrolled prerendered page paints at the restored position (0 jumps in a reload-scroll measurement on a sample app or the itsjavi.com port)
- [x] #2 The byte cost of the change is measured on the sample apps and recorded in the task
- [x] #3 concepts/styles.md (In builds) describes the new rule
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce with the port's reload-scroll method (30 reloads, Chromium, 1280×800, `scrollY` in the first 12 animation frames) on the port's build and two sample apps, comparing the build as it is, the page's own CSS inlined at any size, all CSS inlined, and a parser-blocking script after the links.
2. Implement the variant that fixes it at the lowest byte cost, in builds and dev, with unit, build, dev and CSP tests.
3. Measure after on the sample apps, record bytes, update concepts/styles.md (In builds) and security.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova, 2026-10-15 (worker of Lux, branch claude/nova-t278-f034d1).

**Cause (diagnosed).** On a reload, Chrome lays out the page when parsing ends even while render-blocking stylesheets are still loading, restores the scroll anchor from that unstyled layout (in the port: `scrollY` 6632 of a 9099 px unstyled page), the styled page then clamps it to its end (1596), and the restore at `load` moves it to 1400. Any linked stylesheet races with the end of parsing, the shared file included; removing every script (island loader, theme script) changed nothing.

**Choice: a parser-blocking script after the linked stylesheets, not more inlining.** A parser-inserted classic script runs only once the stylesheets before it have loaded (script-blocking stylesheets), so the parser reaches the body after the CSS and the first layout is styled. The script must not be empty: `<script></script>` is skipped (HTML "prepare the script element") and still jumped 10/30; any text waits. The page's own CSS inlined at any size (the task's proposed fix) still jumps, because the shared file stays linked. The first paint waits for the stylesheets either way, so only DOMContentLoaded can move (to after the CSS arrives).

Reloads that jumped, of 30 (Chromium 1280×800; "barrier" = the build plus the script, simulated on the old output):

| Page (scrollY) | as built | page CSS inlined | all CSS inlined | barrier |
| --- | --- | --- | --- | --- |
| itsjavi.com port `/` (1400) | 11 (1596 → 1400) | 9 (1334 → 1400) | 0 | 0 |
| same, assets cached (max-age=600) | 9 | 9 | 0 | 0 |
| ssg-travel-journal `/` (700) | 12 | 12 | 0 | 0 |
| ssg-travel-journal `/posts/atacama-night-sky/` (1000) | 20 | 13 | 0 | 0 |
| apps/web `/docs/concepts/styles/` (1400) | 8 | 5 | 0 | 0 |
| apps/web `/` (1400) | 23 | 7 | 0 | 0 |

After the change (real builds; travel journal with its CSP hash policy in place): 0/30 on all four sample pages, uncached and cached.

**Bytes (AC #2), brotli q11.** Real build before → after, per page that links a stylesheet: apps/web +54 B raw, about +12 B brotli; ssg-travel-journal (csp: "strict") +104 B raw, +59 B brotli (the script plus its `'sha256-…'` in the policy). The alternatives, for a visit to every page (HTML + each CSS file once): travel journal 74.8 kB as built, 75.3 kB with the script, 85.0 kB with page CSS inlined (+10.2 kB, still jumps), 115.0 kB all inlined (+40.2 kB); apps/web 976.4 / 978.5 / 1168.1 (+191.7) / 1625.4 kB (+649.0); the port 187.7 / 188.4 / 279.6 (+91.9) / 308.7 kB (+121.0). A first view of `/` gets 0.5–1 kB smaller with all CSS inlined, so the script keeps TASK-121's grouping and `INLINE_LIMIT` (4 kB) unchanged.

**Implementation.** `STYLESHEETS_LOADED` (internal constant, `lumiose/src/app/server/stylesheets.ts`): `<script>/* waits for the stylesheets above */</script>`, written by `stylesheetTags` after the tags when any of them is a `<link>` (not when everything is inline), and by the dev server after its per-file links. With `csp: "strict"` it gets the nonce per request, or its hash on prerendered pages (`'sha256-EVyfVJPXQgWL4Z8VuirsbMQKKSpEvVZqItEGgb749FQ='`), through the existing paths. No new public option or name. The dev morph matches it by content, so it stays across server-only edits.

**Docs.** concepts/styles.md (In builds) describes the script and why; concepts/security.md lists it among the inline scripts that get the nonce. llms-full.txt regenerated.

**Port.** The itsjavi.com port depends on the published lumiose 0.4.0, so it was measured with the identical script inserted into its existing output (0/30), not rebuilt with this branch; the port repository was not modified.

**Decision to record (Lux).** "Pages that link stylesheets hold the parser with an inline script after them, instead of inlining more CSS" (rationale above); proposed for a decision record, not written by this worker.

Validation: pnpm check green (1982 tests, size caps OK: 9.22 / 13.32 kB brotli); docs:check green; all 14 Playwright suites pass (ssg-travel-journal's inline-script list updated for the new script; its strict-CSP test passes with the hashed script). Root oxfmt --check flags 6 benchmark result JSONs untouched here (CI runs fmt:examples, which passes).

2026-10-15 (Lux): recorded as decision-60.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chrome restored a reloaded page's scroll position from a layout made before its linked stylesheets loaded. Pages that link a stylesheet now get `<script>/* waits for the stylesheets above */</script>` after their stylesheet tags (builds and dev; nonce'd or hashed under csp: "strict"), which holds the parser until the CSS loads. Reloads that jumped: 0/30 on ssg-travel-journal and apps/web pages (8–23/30 before) and on the itsjavi.com port output (11/30 before). Cost: 54 B raw per page (about 12 B brotli; +59 B brotli with a strict-CSP hash). Inlining the page's own CSS at any size still jumped (5–13/30) and cost 10–192 kB more per full visit, so TASK-121's grouping and the 4 kB limit stay. Docs: concepts/styles.md (In builds), concepts/security.md.
<!-- SECTION:FINAL_SUMMARY:END -->
