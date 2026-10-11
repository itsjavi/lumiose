---
id: TASK-213
title: Landing redesign per decision-37
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 03:33'
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
- [x] #1 Hero, table and sections match decision-37, in that order
- [x] #2 Every number and table cell comes from committed results through content modules checked by tests; no 'not measured' cells
- [x] #3 The page meets the site's accessibility and payload budgets, with screenshots in backlog/assets linked from this task
- [x] #4 axe reports no WCAG 2.0/2.1/2.2 A or AA violations on the landing (TASK-219's suite), and the manual criteria hold
- [x] #5 The light field is a self-written WebGL island, no three.js or GSAP; its JS (brotli) is reported, loads after first paint, and the page renders fully without it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): keep the landing lean. Landing = hero (pre-release as a badge), the stack table, four short sections (one sentence, one visual, one link each: Familiar to write, Every rendering mode, Light and fast, Explicit for you and your agent) and a closing CTA. Depth moves out: performance charts to /benchmarks, mode cards and the examples grid to /showcase, tooling, security and toolchain to the docs and the footer. Visual direction comes from the design spike in .local/design-spike/ once the user picks one.

User 2026-10-11 (design spike in .local/design-spike/): the prism direction was rejected as too close to Vercel's visual language. Candidates: A 'Lumen' (dark, a three.js light field, with a pause control) and C 'Lit windows' (the page as a building at night: rendered HTML windows stay dark, interactive ones light up; a Static/Server/Islands/SPA switch). Both pass axe with no WCAG 2.2 A/AA violations. The direction is still the user's call. Accessibility (decision-39) is part of done: ambient motion pausable, reduced motion honoured, text over moving backgrounds on a guaranteed-contrast backdrop.

User 2026-10-11: the visual direction is A 'Lumen' (.local/design-spike/a-lumen.html, the accessible version with the menu bar, the copy scrim and the pause control). C 'Lit windows' was rejected. The descriptor now says 'TSX with scoped CSS built in' (decision-37).

User 2026-10-11: no eval work for now (TASK-207, TASK-208 and TASK-209 are on hold). TASK-213 no longer waits for TASK-207. The 'Explicit, for you and your agent' section ships without agent eval numbers, describing docs, diagnostics and MCP instead, and gains the numbers once TASK-207 runs.

Lux (2026-10-11): the user deferred all benchmarks. TASK-213 builds the landing now from the current committed results, with 'measuring' cells where results are missing. It is not pushed: TASK-235 runs the measurements, fills the cells and publishes. Implementation: recreate design A ('Lumen', .local/design-spike/a-lumen.html) without three.js or GSAP. Those libraries add more than 100 kB and would contradict '0 kB of JavaScript' on our own homepage. Use a hand-written WebGL fragment shader island (a few kB brotli, loaded on idle or visible), CSS for the headline light sweep, the CSS gradient as the no-JS/no-WebGL fallback, a pause control (WCAG 2.2.2) and reduced-motion support (decision-39).

Beacon (2026-10-11, commits f68c973, 8d62e19): built per decision-37 and its amendments, from the current committed results; not pushed (TASK-235 measures, fills the cells and publishes).

- Data: content/stacks.ts (typed table: facts written there, measured cells from evidence.ts), evidence.ts now also reads the newest full fullstack run (payload.home.js-brotli) and every js-framework-benchmark column; content/release.ts reads the version for the badge. Missing results show 'measuring' (SolidStart, SvelteKit, Nuxt, Remix 3 server JS; Vue and Preact client speed). TASK-235 only commits results: the app ids (solid-start, sveltekit, nuxt, remix) and jsfb columns (vue, preact-hooks) are already mapped; content.test.ts checks that a committed result fills its cell. Preact's server-JS cell says 'No full-stack layer'; Astro's says 0 kB (by design, not measured) and 'Islands need a second UI framework'.
- Light field: islands/LightField.stsx + lib/light-field.ts, plain WebGL (fragment shader for glow, rays and nebula, 220 points for photons), no three.js or GSAP. 6.2 kB raw, 2.6 kB brotli, client:idle (after first paint). Pauses with a visible button and off-screen; reduced motion draws one still frame with no loop and no button; the CSS gradient is the no-JS/no-WebGL fallback. Headline sweep: CSS @keyframes, once (1.8 s), off under reduced motion.
- Payload (static build, 1440 px): initial JS 12.4 kB brotli (loader 9.9, SiteNav 0.9, ThemeToggle 0.7, CopyButton 0.6, shared 0.3); after idle +2.6 kB (LightField) = 15.0 kB; when the demo is visible +163.6 kB JS (Playground 143.8, runtime 15.6, wasm glue 4.2) and the 1254 kB brotli compiler wasm (TASK-211, unchanged).
- Moved off the landing: charts (server JS, client CPU, SSR, size) to /benchmarks; rendering-mode cards with their live apps to /showcase (content/showcase.ts renderingModes, shared with the landing tiles); tooling, security and MCP to the footer (Security, MCP server, Coming from React) and the docs.
- Contrast: hero is a night stage (data-theme=dark) in both themes; scrim strengthened over the mockup, stage copy lighter (--lm-muted #cfcee6), headline gradient ends at #b8b0ff. New e2e test hides the copy, samples the canvas at 1440/820/390 px over 6 s and checks every text color against the brightest pixel behind it: peaks rgb(22,20,46), rgb(30,25,46), rgb(46,43,59), all AA. FLATTENED gained the stage (STAGE_PEAK #302e40), boxes, Lumiose's row, the closing glow and the install box.
- Checks: lumiose check clean; oxlint clean; vitest 21/21; web e2e 61 passed, 3 skipped (screenshot captures), including axe on the landing in light and dark, motion, focus, target size, pause and reduced-motion tests, and the no-JS landing.
- Screenshots: backlog/assets/task-213-1440-light.png, task-213-1440-dark.png, task-213-390-light.png, task-213-390-dark.png (SCREENSHOTS=1 pnpm screenshots).
- Deliberate differences from the mockup: the site-kit sticky header (follows the site theme) instead of the nav inside the hero; the hero is dark in both themes, sections below follow the theme with the same glows; the light sits above the copy on narrow screens, with the copy starting below it; no GSAP scroll effects (box and row lighting is static); the install line is npm only with a copy button; the version badge reads the package version (0.1.0 today); 'Explicit' links to the MCP docs and shows real lumiose check output; the closing CTA adds 'Coming from React'; the 'Familiar to write' box is the live editor (TASK-211), full width.
- Found: every page has two <meta name=description> (document.tsx default plus the page's <Meta>); recorded as TASK-238 (Nova).
- Left for TASK-235: the 'measuring' cells; the hero and table numbers update from the new results without code changes.
<!-- SECTION:NOTES:END -->
