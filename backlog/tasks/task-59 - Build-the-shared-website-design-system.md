---
id: TASK-59
title: Build the shared website design system
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 15:58'
updated_date: '2026-10-08 16:18'
labels: []
milestone: m-5
dependencies:
  - TASK-45
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
- [ ] #1 packages/site-kit (private, @lumen/site-kit): tokens.ts (colors with light/dark, spacing, radii, typography, breakpoints) used via $tokens, a global base stylesheet (<style global>), and .stsx components: SiteHeader/nav, Footer, Button/Link, Callout, CodeBlock (stsx-aware highlighting hook), Tabs, Card, ThemeToggle (island)
- [ ] #2 Components documented with a small example page; consumed by apps/web and apps/playground; lumen check passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. packages/site-kit (@lumen/site-kit, private, lumen workspace:*): src/tokens.ts (light/dark palettes, semantic color tokens as var() refs, space/radius/type/breakpoint/shadow/motion scales), src/theme.ts (storage key, init script), src/highlight.ts (small stsx-aware highlighter usable as the CodeBlock hook).
2. Base.stsx: <style global> with theme custom properties (light-dark() + color-scheme, prefers-color-scheme default, [data-theme] override), reset, typography, focus rings, code font, imported by index.ts.
3. Components (.stsx, placement-scoped <style>, $tokens, class objects): SiteHeader (+ SiteNav island: active state, mobile menu w/ keyboard), Footer, Button/LinkButton, Callout, CodeBlock (+ CopyButton island), Tabs (ARIA tabs, roving tabindex), Card, ThemeToggle (island, localStorage).
4. Showcase: packages/site-kit/showcase as a nested Lumen root (Vite + lumen/vite client app) rendering every component; Playwright spec for behaviour + light/dark screenshots into backlog/assets/task-59-*.png.
5. Validate: lumen check (kit + showcase), oxlint, oxfmt, vite build; record framework bugs as follow-ups.
<!-- SECTION:PLAN:END -->
