---
id: TASK-505
title: >-
  Reflow checks fail on Linux, where long words set in DejaVu Sans overflow 320
  px
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:56'
updated_date: '2026-10-21 05:48'
labels:
  - test
  - a11y
dependencies: []
priority: high
ordinal: 501000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI e2e (ubuntu) failed in every run since 38880800285 on two 320 px reflow checks with WCAG text spacing (1.4.10, 1.4.12): apps/web/e2e/a11y.e2e.ts 'docs and UI pages reflow at 320 px' (/ui/accordion overflows by 21 px) and examples/ui-e2e/e2e/autocomplete.e2e.ts 'the form reflows at 320 CSS pixels' (h1 'Autocomplete' and main clipped), in dev and build. Deterministic on Linux, never on macOS: the site's Inter and the fixture's system-ui are not installed on the runner, so Chromium falls back to DejaVu Sans, much wider than macOS's SF, and one long word ('Autocomplete') no longer fits. Reproduced in Linux Chromium (Playwright 1.63.0 Docker image with fonts-dejavu-core): the same 21 px and the same clipped elements. Causes in the pages, not the tests: the docs' prev/next grid ('1fr 1fr' keeps a column at its min-content width) and the docs and fixture page titles (h1 without overflow-wrap). The a11y test stops at its first failing page, so /ui/autocomplete (31 px, its h1), /ui/avatar, /ui/checkbox-group, /ui/installation and /ui/theming (their Next links) were hidden behind /ui/accordion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The docs' prev/next links and page titles break long words instead of widening the page
- [x] #2 The ui-e2e fixture's page titles break long words
- [x] #3 Both reflow tests pass in Linux Chromium with DejaVu Sans and in macOS Chromium, 5 repeats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): reproduced in Linux Chromium (Playwright 1.63.0 Docker image plus fonts-dejavu-core, which CI's runner has): 21 px on /ui/accordion and the same clipped h1 and main as CI; the image without DejaVu Sans passes, which is how such failures slip through. Overflowing elements found with a scan of every reflow page at 320 px with text spacing. Fixes: DocArticle.stsx's .adjacent grid is repeat(2, minmax(0, 1fr)) and its links and the page h1 use overflow-wrap: anywhere; examples/ui-e2e/src/example.css gives h1 overflow-wrap: anywhere. Checked with CI=1: both reflow tests 5 times in Linux and in macOS Chromium; the full apps/web suite in Linux and macOS Chromium (179 passed, 4 skipped each); ui-e2e in Linux Chromium, Firefox and WebKit. CONTRIBUTING (Continuous integration) now says how to check a layout test in Linux Chromium with DejaVu Sans.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Long words no longer widen 320 px pages in wide fallback fonts: the docs' prev/next grid tracks can shrink and their links, the docs title and the ui-e2e fixture titles break long words. Both reflow checks pass in Linux (DejaVu Sans) and macOS Chromium.
<!-- SECTION:FINAL_SUMMARY:END -->
