---
id: TASK-213
title: Landing redesign per decision-37
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 03:07'
labels:
  - landing
  - positioning
milestone: m-7
dependencies:
  - TASK-211
  - TASK-212
  - TASK-214
  - TASK-215
  - TASK-219
priority: high
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/). Hero: eyebrow "Static · Server · Islands · SPA — one framework", H1 "Feels like React. Runs like vanilla JS.", a sub on TSX with scoped CSS built in, per-route rendering and 0 kB where pages don't move, CTAs Get started / Compare the stacks / Playground, proof row 1.05x vanilla JS · 0 kB JS on server pages · 6.5 kB app. Directly below: the stack comparison table (React + Next.js, React Router, Solid + SolidStart, Svelte + SvelteKit, Vue + Nuxt, Preact, Remix 3, Astro, Lumiose; columns: full-stack layer, styles, JS on a server page, client speed, interactive parts use the same components), Astro shown honestly (0 kB too, islands need a second UI framework). Then, in order: Familiar to write (React-like JSX, one file per component with scoped CSS built in, stock TypeScript; the live demo island) → Every rendering mode (static → islands → server → SPA, each linked to a live example app) → Light and fast, measured (fullstack vs Next.js and React Router first, then js-framework-benchmark and SSR) → Explicit, for you and your agent (no hidden machinery, LUM codes with fixes, agent eval numbers) → secure by default, toolchain, pre-release note. Claims follow the decision: near-vanilla and Solid-class, never 'fastest' or smallest; .stsx first named in the authoring section.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hero, table and sections match decision-37, in that order
- [ ] #2 Every number and table cell comes from committed results through content modules checked by tests; no 'not measured' cells
- [ ] #3 The page meets the site's accessibility and payload budgets, with screenshots in backlog/assets linked from this task
- [ ] #4 axe reports no WCAG 2.0/2.1/2.2 A or AA violations on the landing (TASK-219's suite), and the manual criteria hold
- [ ] #5 The light field is a self-written WebGL island, no three.js or GSAP; its JS (brotli) is reported, loads after first paint, and the page renders fully without it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): keep the landing lean. Landing = hero (pre-release as a badge), the stack table, four short sections (one sentence, one visual, one link each: Familiar to write, Every rendering mode, Light and fast, Explicit for you and your agent) and a closing CTA. Depth moves out: performance charts to /benchmarks, mode cards and the examples grid to /showcase, tooling, security and toolchain to the docs and the footer. Visual direction comes from the design spike in .local/design-spike/ once the user picks one.

User 2026-10-11 (design spike in .local/design-spike/): the prism direction was rejected as too close to Vercel's visual language. Candidates: A 'Lumen' (dark, a three.js light field, with a pause control) and C 'Lit windows' (the page as a building at night: rendered HTML windows stay dark, interactive ones light up; a Static/Server/Islands/SPA switch). Both pass axe with no WCAG 2.2 A/AA violations. The direction is still the user's call. Accessibility (decision-39) is part of done: ambient motion pausable, reduced motion honoured, text over moving backgrounds on a guaranteed-contrast backdrop.

User 2026-10-11: the visual direction is A 'Lumen' (.local/design-spike/a-lumen.html, the accessible version with the menu bar, the copy scrim and the pause control). C 'Lit windows' was rejected. The descriptor now says 'TSX with scoped CSS built in' (decision-37).

User 2026-10-11: no eval work for now (TASK-207, TASK-208 and TASK-209 are on hold). TASK-213 no longer waits for TASK-207. The 'Explicit, for you and your agent' section ships without agent eval numbers, describing docs, diagnostics and MCP instead, and gains the numbers once TASK-207 runs.

Lux (2026-10-11): the user deferred all benchmarks. TASK-213 builds the landing now from the current committed results, with 'measuring' cells where results are missing. It is not pushed: TASK-235 runs the measurements, fills the cells and publishes. Implementation: recreate design A ('Lumen', .local/design-spike/a-lumen.html) without three.js or GSAP. Those libraries add more than 100 kB and would contradict '0 kB of JavaScript' on our own homepage. Use a hand-written WebGL fragment shader island (a few kB brotli, loaded on idle or visible), CSS for the headline light sweep, the CSS gradient as the no-JS/no-WebGL fallback, a pause control (WCAG 2.2.2) and reduced-motion support (decision-39).
<!-- SECTION:NOTES:END -->
