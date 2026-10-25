---
id: TASK-586
title: >-
  Docs and examples use CSS custom properties for design tokens; $name for
  breakpoints and JS-shared values
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-25 02:13'
updated_date: '2026-10-25 02:33'
labels:
  - docs
  - css
milestone: m-14
dependencies: []
references:
  - >-
    backlog/decisions/decision-87 -
    Design-tokens-are-CSS-custom-properties-name-is-for-breakpoints-and-values-shared-with-JS.md
priority: medium
ordinal: 578000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Requested by the user on 2026-10-25 (decision-87): stop promoting a tokens.ts design system read through $name; design tokens are CSS custom properties, and $name is kept for breakpoints and values that JS code also needs. Applies to the Lumiose styles page, the STSX docs and @lumiose/stsx README, the examples (vite-counter, stsx-react, stsx-react-router, stsx-solid), the landing page sample and the agent guidance of lumiose agents init.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Lumiose styles page has a section on custom properties versus $name, and its examples declare tokens as custom properties, with $name only for breakpoints or JS-shared values
- [x] #2 The STSX docs and the @lumiose/stsx README follow the same guidance
- [x] #3 The examples declare their design tokens as custom properties; tokens.ts design systems are gone, and a breakpoint shared by @media and JS shows the legitimate $name case
- [x] #4 The landing page sample and the agent guidance follow the guidance
- [x] #5 docs:gen, docs:check and the affected tests pass
- [x] #6 The docs present typed custom property names (an as const names module read with var($vars.name)) as the optional pattern for typo checks and JS access, and at least two examples use it (decision-87 amendment)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): taken in the standalone M14 run at the user's request.

2026-10-25 (Lux): the user chose the name form for typed custom property names ("brand": "--brand", read as var($vars.brand)); decision-87 amended, AC #6 added.

2026-10-25 (Lux):

**Docs.**
- `concepts/styles.md`: a "Design tokens" section (custom properties on `:root`, typed names with `var($vars.name)`, when to use `$name`). The first example uses `var()`; the nested-block, Meter and Example samples use `$` only for values JS also uses (columns, ticks, a breakpoint), with the Meter's CSS output regenerated. Two new common mistakes; API rows for `var(--name)` and `var($vars.name)`.
- `coming-from/astro.md` (`define:vars` row) and `reference/jsx.md` updated.
- STSX: heroes in `docs/README.md` and the package README use `var(--brand)`; `docs/styles.md` gains "Design tokens: custom properties", a `$name` section reframed around breakpoints and JS-shared values, and the React `CSSProperties` augmentation for custom property keys in `style` (tsc rejects them otherwise; Solid accepts them). `type-checking.md` example uses `var($vars.brnd)` (the shadow emits `;vars.brnd;`, so tsc reports it).

**Examples.** The four `tokens.ts` design systems are gone.
- vite-counter and stsx-react: typed names in `vars.ts`, values on `:root` in App.stsx's `<style global>`.
- stsx-react also has `layout.ts` with `BREAKPOINT`, read by `@media` and by `matchMedia` (a `useNarrow` hook).
- stsx-solid and stsx-react-router use plain `var(--…)`.
- vite-counter's HMR spec now edits `vars.ts` (accent → `--danger`) to keep the `$`-dependency hot-update coverage.

**Landing and guidance.** The landing Counter and the playground's scoped sample use custom properties (counterOutput and counterCss regenerated). The agent guidance from `lumiose agents init` says design tokens are custom properties and `$name` is for conditions and JS-shared values.

**Checked:**
- cli docs examples type-check, cli agents and docs tests (41), stsx tests (24), web content tests (25);
- smoke tests and typecheck of the three stsx examples (router 5);
- vite-counter `lumiose check` and Playwright (10 passed, 4 skipped as before);
- lumiose and stsx docs:gen and docs:check; `pnpm fmt:examples`.

**Left out:** examples/ssg-travel-journal and examples/ssr-bookshelf still use a `theme.ts` design system (TASK-587). The eval task `styled-badge` tests `$` constants on purpose and is unchanged.
<!-- SECTION:NOTES:END -->
