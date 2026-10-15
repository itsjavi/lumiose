---
id: TASK-406
title: Site a11y suite covers every UI page
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 22:29'
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
- [ ] #1 Every /ui page is in the site's axe suite, in light and dark, and a new docs page is picked up automatically
<!-- AC:END -->
