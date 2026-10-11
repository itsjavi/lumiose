---
id: decision-39
title: 'The website meets WCAG 2.2 AA, checked with axe in e2e'
date: '2026-10-11'
status: accepted
---
## Context

In the 2026-10-11 design spike, the first landing alternative put its menu text on top of an animated light source, and the text became unreadable. Its background also moved indefinitely with no way to pause it.

The website has no automated accessibility checks. Its Playwright suite (`apps/web/e2e`) tests behaviour only.

## Decision

Required by the user on 2026-10-11.

- Every page of the website meets WCAG 2.2 AA:
  - the landing page
  - the docs
  - benchmarks
  - showcase and demo indexes
  - the playground
  - error pages
- **Enforced with axe.** `@axe-core/playwright` in the e2e suite fails on any violation of the WCAG 2.0, 2.1 or 2.2 A or AA rules. Axe's "needs review" results, such as text on gradients or canvases, are listed and checked by hand.
- **Checked by hand,** for what axe cannot see:
  - ambient motion longer than 5 seconds has a pause control (2.2.2)
  - `prefers-reduced-motion` stops non-essential motion
  - focus is visible (2.4.7) and not hidden by sticky UI (2.4.11)
  - targets are at least 24 px (2.5.8)
  - text over moving or image backgrounds sits on a backdrop that guarantees 4.5:1
- **Visual direction stays open.** It is free as long as it passes these checks. Effects never carry information that isn't also given as text.

## Consequences

- TASK-219 (Beacon) adds the axe suite and fixes current violations, including any in `@lumiose/site-kit`.
- The landing redesign (TASK-213) depends on TASK-219 and counts these checks as part of done.
- The showcase apps get the same bar when they move to `/showcase` (TASK-215, TASK-217, TASK-218).
