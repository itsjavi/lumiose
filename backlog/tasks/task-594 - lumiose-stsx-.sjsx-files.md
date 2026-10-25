---
id: TASK-594
title: '@lumiose/stsx: .sjsx files'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 04:12'
labels:
  - sjsx
  - stsx
milestone: m-15
dependencies:
  - TASK-593
priority: medium
ordinal: 586000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: `@lumiose/stsx` serves `.sjsx` files to React, React Router and Solid as it serves `.stsx` (packages/stsx/src).

- **Virtual ids.** `X.sjsx.jsx` and `X.sjsx.css`, so the framework plugins' `.[jt]sx?` filters accept them.
- **Hooks.** resolveId, load, transform, the dev URL rewrite, the dependency-scan plugin, HMR (one update per save, CSS-only updates), the fs.allow check (TASK-588) and source maps all take both extensions.
- **React Router guard.** It also rejects `.sjsx` route modules: the route-export check and the internal-id check.
- **Typegen.** `stsx typegen` and the plugin write `X.sjsx.jsx` shadows into the same directory, and remove stale ones.
- **Tests** mirror the `.stsx` ones for React, Solid and React Router, with a `.sjsx` fixture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 React, React Router and Solid serve .sjsx components in dev and builds, with HMR, source maps and per-route CSS as for .stsx
- [ ] #2 stsx typegen writes X.sjsx.jsx shadows; the React Router guard rejects .sjsx route modules; tests mirror the .stsx ones
<!-- AC:END -->
