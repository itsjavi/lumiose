---
id: TASK-59
title: Build the shared website design system
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 15:58'
updated_date: '2026-10-08 16:41'
labels: []
milestone: m-5
dependencies:
  - TASK-45
references:
  - backlog/assets/task-59-showcase-light.png
  - backlog/assets/task-59-showcase-dark.png
  - backlog/assets/task-59-phone-light.png
  - backlog/assets/task-59-phone-dark.png
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The marketing site, the docs and the playground share a look and building blocks. A shared Lumen component package keeps them consistent, and dogfoods authoring a .stsx component library in a workspace package.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/site-kit (private, @lumen/site-kit): tokens.ts (colors with light/dark, spacing, radii, typography, breakpoints) used via $tokens, a global base stylesheet (<style global>), and .stsx components: SiteHeader/nav, Footer, Button/Link, Callout, CodeBlock (stsx-aware highlighting hook), Tabs, Card, ThemeToggle (island)
- [x] #2 Components documented with a small example page (packages/site-kit/showcase + README) and consumable from another Lumen root; lumen check passes. Consumption by apps/web and apps/playground is verified by TASK-57 (AC #3) and TASK-58 (AC #2), which depend on this task
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/site-kit (@lumen/site-kit, private, lumen workspace:*): src/tokens.ts (light/dark palettes, semantic color tokens as var() refs, space/radius/type/breakpoint/shadow/motion scales), src/theme.ts (storage key, init script), src/highlight.ts (small stsx-aware highlighter usable as the CodeBlock hook).
2. Base.stsx: <style global> with theme custom properties (light-dark() + color-scheme, prefers-color-scheme default, [data-theme] override), reset, typography, focus rings, code font, imported by index.ts.
3. Components (.stsx, placement-scoped <style>, $tokens, class objects): SiteHeader (+ SiteNav island: active state, mobile menu w/ keyboard), Footer, Button/LinkButton, Callout, CodeBlock (+ CopyButton island), Tabs (ARIA tabs, roving tabindex), Card, ThemeToggle (island, localStorage).
4. Showcase: packages/site-kit/showcase as a nested Lumen root (Vite + lumen/vite client app) rendering every component; Playwright spec for behaviour + light/dark screenshots into backlog/assets/task-59-*.png.
5. Validate: lumen check (kit + showcase), oxlint, oxfmt, vite build; record framework bugs as follow-ups.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (session halo-task59-20261008T161408Z). Implementation:
- packages/site-kit (@lumen/site-kit, private, lumen workspace:*; exports '.', './tokens', './theme', './highlight').
- src/tokens.ts: light/dark palettes; semantic colors as var(--lm-*) refs; syntax, gradient (brand, glow, text), font, text (type scale incl. fluid display), leading, weight, space, radius, bp, layout, shadow, motion, z, focus. Every text/background pair checked for WCAG AA (body text AAA) in both themes; gradient text uses a dedicated glowText stop (AA).
- src/Base.stsx: <style global> only. Colors are light-dark() pairs on ':root, [data-theme]'; ':root' follows prefers-color-scheme via color-scheme: light dark; data-theme=light|dark pins the root or any subtree. Reset (zero-specificity :where), typography, links, code/kbd font, :focus-visible ring, .sr-only, reduced motion. Loaded first by src/index.ts.
- Components (.stsx, placement-scoped <style>, $tokens, class objects for variants): SiteHeader (logo/actions slots, uses <SiteNav client:load> and <ThemeToggle client:load>), SiteNav (island: aria-current active state, disclosure menu below $bp.md, Escape returns focus, click outside closes), Footer, Logo (CSS-only orb), Button/LinkButton (primary/secondary/ghost x sm/md/lg; file-level block shared by both), Callout (info/warn/tip, role=note), Card (stretched link, glow on hover/focus-within), CodeBlock (title bar, highlight hook, <CopyButton client:visible>), CopyButton (island, live region), Tabs (WAI-ARIA tabs: labels prop + one child element per panel, roving tabindex, arrows/Home/End; island-friendly), ThemeToggle (island; icon follows the theme via :global(:root[data-theme]) CSS, aria-pressed after mount, localStorage 'lumen-theme'), theme.ts (themeInitScript for <head>).
- src/highlight.ts: small highlighter (TS/TSX/JSON, .stsx with style blocks as CSS and $refs, CSS, shell) emitting tok-* spans; unit tests in src/highlight.test.ts (vitest.config.ts scopes the root Vitest project to src/**/*.test.ts so the Playwright spec is not collected).
- showcase/: nested Lumen root (Vite + lumen/vite client app, index.html with the theme init script) rendering every component, plus a side-by-side data-theme light/dark comparison; Playwright spec (dev + vite build/preview): render without errors, SVG namespace in branches, aria-current, theme toggle switch/persist/system, data-theme subtree, Tabs keyboard, copy to clipboard, phone menu (Escape, focus return, outside click), screenshots.

Validation: 'pnpm --filter @lumen/site-kit typecheck' (lumen check kit + showcase): No problems found. lumen lint (kit, showcase): no problems. lumen fmt --check: all .stsx formatted; oxfmt --check and oxlint clean. Vitest: 6/6. Playwright: 14/14 (7 specs x dev, preview). Screenshots (production build): backlog/assets/task-59-showcase-light.png, task-59-showcase-dark.png, task-59-phone-light.png, task-59-phone-dark.png.

Findings (follow-ups created):
- TASK-73 (Beacon): lumen check cannot resolve .stsx imports that leave src/ (shadow location vs rootDirs) nor .stsx modules of workspace packages. Workaround here: showcase/src/kit.ts + rootDirs '../src', '../.lumen/shadow/src' after checking the kit first. TASK-57/58 will hit the second case.
- TASK-74 (Photon): islands in modules outside the Vite root get absolute filesystem refs (machine paths in island records) and the manifest scan covers only the root; affects site-kit's SiteNav/ThemeToggle/CopyButton in apps/web. Unverified end to end (hydration is TASK-18).
- TASK-75 (Photon): class passthrough is silently lost when props.class is read inside a helper used as an element's class (no applyScope emitted). Worked around by inlining the class arrays.
- TASK-76 (Halo): invalid values of known properties (e.g. 'grid-template-columns: 2fr repeat(auto-fit, …)') pass lumen_css without a diagnostic; the footer layout was silently dropped by the browser before it was caught visually.
- Design note (not a bug): Vite's production CSS minifier lowers light-dark() for its default targets into --lightningcss-light/dark variables, which resolve where a custom property is declared, not where it is used. Dev keeps native light-dark(). Hence the kit declares its properties on ':root, [data-theme]' and documents data-theme (not color-scheme) for nested themes; the Playwright 'data-theme subtree' spec runs on the production build too.
- AC #2 refined: apps/web and apps/playground do not exist yet and depend on this task; their own ACs (TASK-57 #3, TASK-58 #2) cover consuming the kit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built @lumen/site-kit: tokens.ts (light/dark palettes, semantic var() colors, spacing, radii, type scale, breakpoints, shadows, motion), a global base stylesheet (light-dark() theme properties following prefers-color-scheme with a data-theme override on the root or any subtree, reset, typography, focus rings, code font) and .stsx components authored with placement-scoped style blocks and $tokens: SiteHeader with the SiteNav island (active state, keyboard-accessible mobile menu), Footer, Logo, Button/LinkButton (variant/size class objects), Callout (info/warn/tip), Card, CodeBlock (highlight hook, CopyButton island) with a small .stsx-aware highlighter, Tabs (WAI-ARIA keyboard pattern) and the ThemeToggle island (localStorage, CSS-driven icon, themeInitScript). A showcase (nested Lumen root, Vite client app) renders every component; Playwright covers behaviour on dev and production builds and captured light/dark desktop and phone screenshots (backlog/assets/task-59-*.png). lumen check, lumen lint/fmt, oxlint/oxfmt and unit tests pass. Framework findings recorded as TASK-73 (check across src/ and packages), TASK-74 (island refs outside the Vite root), TASK-75 (lost class passthrough), TASK-76 (invalid CSS values not reported).
<!-- SECTION:FINAL_SUMMARY:END -->
