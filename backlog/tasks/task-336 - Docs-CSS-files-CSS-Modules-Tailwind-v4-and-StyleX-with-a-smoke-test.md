---
id: TASK-336
title: 'Docs: CSS files, CSS Modules, Tailwind v4 and StyleX, with a smoke test'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 04:11'
updated_date: '2026-10-15 06:40'
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
- [x] #1 A smoke test in CI covers dev and a production SSR build of an app that uses a global .css file, a CSS module, Tailwind v4 utilities written in .stsx files (strings, arrays and records in `class`) and, if the spike recommends support, StyleX: the expected rules ship, are linked in the server-rendered HTML and hydrate without mismatches
- [x] #2 concepts/styles.md documents each approach with a type-checked example, including the scope and loading rules of imported .css files and any limits found by the smoke test
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 5).

Nova (2026-10-15), done:
- Smoke test: examples/ssr-styles-e2e (kind e2e, so CI's ubuntu e2e job runs it; ports 5215 dev, 5216 preview). A server-mode app with src/styles/app.css (@import "tailwindcss") imported by the root layout, a route-only about.css, a CSS module used by a server component and an island, style blocks, and Tailwind utilities in strings, arrays and records of class. Playwright, dev and a production build served by lumiose preview (adapter-node), 10/10 green: computed styles with JavaScript disabled (the rules ship with the server HTML), the route-only stylesheet only on its route, cascade order, @apply in a block, and the island hydrating the same server node with the server's class string (module class names match), no warnings or errors in the console.
- Pinned devDependencies of the example: tailwindcss 4.3.3, @tailwindcss/vite 4.3.3 (under deps.lock); pnpm-lock.yaml updated for that importer only.
- Findings, documented in concepts/styles.md (new subsection "Stylesheets, CSS Modules and Tailwind", API rows, common mistakes): Tailwind's scanner finds classes in .stsx files with no configuration; dev links imported stylesheets in import order, each file's imports before its own block, layouts before pages; utilities are in @layer utilities, so style blocks and unlayered global CSS win at any specificity (p-8! wins); @apply, theme() and --spacing() work in a scoped block only after @reference to the Tailwind stylesheet (without it the build fails: Cannot apply unknown utility class), and the compiler reports @reference and @apply as LUM3015 warnings (follow-up TASK-339); Tailwind emits theme variables it finds in sources, so var(--color-…) in blocks works.
- StyleX documented as not supported yet per TASK-335 (.stsx not compiled, production builds lose rules, dev-only link to /virtual:stylex.css, stylex.attrs() as the way to apply styles); not in the smoke test.
- Not covered by automated tests: the Tailwind CSS IntelliSense setting (tailwindCSS.includeLanguages mapping stsx to javascriptreact), documented from the extension's own includeLanguages mechanism.
- Checks: docs:gen, docs:check, the docs tests (examples type-check included), oxlint and oxfmt on the example, lumiose check (0 errors, the 2 expected LUM3015 warnings).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Styling docs backed by a smoke test: examples/ssr-styles-e2e checks a global .css file, a route-only stylesheet, a CSS module and Tailwind v4 (strings, arrays and records in class, @apply with @reference) in dev and a production SSR build, without JavaScript and after hydration. concepts/styles.md documents the loading and cascade rules, CSS Modules, the Tailwind v4 setup and its limits (utilities lose to style blocks; @apply needs @reference and warns LUM3015, follow-up TASK-339; IntelliSense setting), and StyleX as not supported yet.
<!-- SECTION:FINAL_SUMMARY:END -->
