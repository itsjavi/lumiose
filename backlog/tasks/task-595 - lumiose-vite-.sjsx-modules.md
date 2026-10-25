---
id: TASK-595
title: '@lumiose/vite: .sjsx modules'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 04:12'
labels:
  - sjsx
  - vite
milestone: m-15
dependencies:
  - TASK-593
priority: medium
ordinal: 587000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: `@lumiose/vite` compiles `.sjsx` modules as it compiles `.stsx` (packages/vite/src outside app/**, which the JavaScript route files task covers).

- **Module handling.** The module filters and the compile options (index.ts), style modules (styles.ts, `?lumiose&type=style&lang.css`), the CSS manifest (css-manifest.ts), client scripts (client-scripts.ts, `?client`), server-only checks (server-only.ts), chunk names and the fs.allow checks (fs-access.ts) all take `.sjsx`.
- **Shadows.** The shadow layout (layout.ts) maps `X.sjsx` to `X.sjsx.jsx`.
- **Islands and HMR.** Island refs, component-level hot updates and style-only hot updates work for `.sjsx` components.
- **Content modules** (`.md.stsx`, `.html.stsx`) stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 .sjsx components compile, style, hydrate as islands and hot-update in lumiose dev and builds as .stsx ones do
- [ ] #2 Tests mirror the .stsx module, style and client-script tests
<!-- AC:END -->
