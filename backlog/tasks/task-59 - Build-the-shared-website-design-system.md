---
id: TASK-59
title: Build the shared website design system
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 15:58'
updated_date: '2026-10-08 16:14'
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
