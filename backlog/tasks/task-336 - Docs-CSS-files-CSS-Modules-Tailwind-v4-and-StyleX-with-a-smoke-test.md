---
id: TASK-336
title: 'Docs: CSS files, CSS Modules, Tailwind v4 and StyleX, with a smoke test'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 04:11'
labels:
  - docs
  - css
  - testing
milestone: m-11
dependencies:
  - TASK-334
  - TASK-335
references:
  - packages/lumiose/docs/concepts/styles.md
priority: medium
ordinal: 338000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15: document the styling approaches Lumiose supports besides scoped `<style>` blocks, and back every claim with a smoke test (concepts/styles.md currently says CSS imports, CSS Modules and Tailwind v4 "still work through Vite", untested). In scope: regular `.css` files, CSS Modules, Tailwind v4 and StyleX; Sass is out of scope.

Keep it short where adoption is straightforward: a section in concepts/styles.md, plus a guide page only if StyleX needs more than a few lines. Cover: imported `.css` files are global (unscoped) but only linked on routes whose import graph reaches them (root layout = every page), and their cascade order relative to `<style>` blocks; CSS Modules usage (after TASK-334); the Tailwind v4 setup (`@tailwindcss/vite` and `@import "tailwindcss"` in a global CSS file imported by the root layout), whether `@apply` and `theme()` work inside scoped `<style>` blocks, and the editor setup for Tailwind IntelliSense in `.stsx` files if one is needed; StyleX per the outcome of TASK-335.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A smoke test in CI covers dev and a production SSR build of an app that uses a global .css file, a CSS module, Tailwind v4 utilities written in .stsx files (strings, arrays and records in `class`) and, if the spike recommends support, StyleX: the expected rules ship, are linked in the server-rendered HTML and hydrate without mismatches
- [ ] #2 concepts/styles.md documents each approach with a type-checked example, including the scope and loading rules of imported .css files and any limits found by the smoke test
- [ ] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
