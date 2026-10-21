---
id: TASK-505
title: >-
  Reflow checks fail on Linux, where long words set in DejaVu Sans overflow 320
  px
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:56'
updated_date: '2026-10-21 04:59'
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
- [ ] #1 The docs' prev/next links and page titles break long words instead of widening the page
- [ ] #2 The ui-e2e fixture's page titles break long words
- [ ] #3 Both reflow tests pass in Linux Chromium with DejaVu Sans and in macOS Chromium, 5 repeats
<!-- AC:END -->
