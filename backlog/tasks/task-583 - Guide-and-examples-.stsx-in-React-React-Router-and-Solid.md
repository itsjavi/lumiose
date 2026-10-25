---
id: TASK-583
title: 'Guide and examples: .stsx in React, React Router and Solid'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:37'
labels:
  - docs
  - stsx
milestone: m-14
dependencies:
  - TASK-579
  - TASK-580
  - TASK-581
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: medium
ordinal: 575000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A docs guide in packages/lumiose/docs/guides/ and three examples: examples/stsx-react, examples/stsx-react-router and examples/stsx-solid. Beacon owns these example directories; Lux adds them to AGENTS.md. Each example gets a build and SSR smoke test in CI, without Playwright unless a check needs a browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A docs guide covers setup, classAttribute, scopedStyles, class passthrough, :deep(), typegen and the React Router limits
- [x] #2 The three examples build in CI with a smoke test each; for React Router, the SSR HTML links each route's CSS
- [x] #3 docs:gen and docs:check pass, and llms.txt is regenerated through the docs generator
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Beacon's task at the user's request (M14 run). The user asked (2026-10-25) for a dedicated STSX docs section on the site with its own llms.txt, planned after this task: the guide is therefore written as packages/stsx/docs (as @lumiose/ui ships packages/ui/docs, decision-64), which that section will render; Lumiose's docs link to it.

2026-10-25 (Lux):

**Examples**, each with a vitest smoke test that `pnpm test` runs (examples/* are Vitest projects) and a typecheck script that `pnpm typecheck` runs:
- **examples/stsx-react** (React + Vite, class strategy, class passthrough to a plain Button.tsx). smoke.test.ts: the production build has `.page.lum-…`, `.increment.lum-…` and the folded constants; the SSR of Counter renders `class="increment lum-…"` on the Button's `<button>`.
- **examples/stsx-react-router** (framework mode with SSR; `.tsx` routes render `.stsx` components; vitest.config.ts keeps React Router's plugin out of Vitest). smoke.test.ts builds with Vite's `createBuilder` (vite.config.ts), imports build/server/index.js and renders through `createRequestHandler`: `/` links root + home CSS, `/about` links root + about CSS, and both render data-lum- markers.
- **examples/stsx-solid** (Solid + Vite; `environment: node`, since vite-plugin-solid would pick jsdom). smoke.test.ts: the build has `.dot[data-lum-…]` and Solid's template `<span data-lum-… class=dot>`.

The typecheck scripts are `stsx typegen && tsc` (React Router: also `react-router typegen`), and all three pass. Playwright is not used. examples/stsx-react-router/.gitignore ignores `.react-router/` and `build/`.

**Guide.** Following the user's request for a dedicated STSX docs section, the guide is packages/stsx/docs (shipped in the package: `files` includes docs):
- README.md: overview, example, status, pages;
- installation.md: React, React Router, Solid, TypeScript, first component;
- styles.md: placement, plain CSS, `$name` constants, dynamic values, `:global()`/`:deep()`, keyframes, specificity, class passthrough, diagnostics;
- options.md: `classAttribute`, `scopedStyles`;
- react-router.md: route modules in `.tsx`, CSS per route, types;
- type-checking.md: shadows, typegen, constants, editors.

Pages follow the docs format (`# Title`, `> summary`) for the llms generator, which the STSX section task adds. Lumiose's styles concept page points to it ("Outside Lumiose"); lumiose docs:gen and docs:check pass and llms-full.txt is regenerated; the CLI docs tests and the site tests pass.

**AGENTS.md.** Beacon owns packages/stsx/docs/** and examples/stsx-*; Photon owns the rest of packages/stsx.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Three examples (stsx-react, stsx-react-router, stsx-solid) with smoke tests and typechecks that run in CI. React Router's checks SSR HTML linking each route's CSS. The guide is packages/stsx/docs (installation, styles, options, React Router, type checking), shipped in the package for the STSX docs section; Lumiose's styles page links to it.
<!-- SECTION:FINAL_SUMMARY:END -->
