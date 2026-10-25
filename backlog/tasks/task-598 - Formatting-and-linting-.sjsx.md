---
id: TASK-598
title: 'Formatting and linting: .sjsx'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-25 04:12'
labels:
  - sjsx
  - tooling
milestone: m-15
dependencies:
  - TASK-593
priority: medium
ordinal: 590000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: formatting and linting support `.sjsx`.

- **`lumiose fmt`** (packages/cli/src/fmt) formats `.sjsx` in parts, as `.stsx`, with a `.jsx` name for the code; `pnpm fmt:examples` covers it.
- **`@lumiose/prettier-plugin`** gets an `sjsx` parser on Prettier's Babel parser, with the same style-block handling as `stsx`.
- **`@lumiose/eslint-plugin`'s processor** and `configs.recommended`, and `lumiose lint`, accept `.sjsx`.
- **Tests** for each, mirroring the `.stsx` ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose fmt, the Prettier plugin, the ESLint plugin and lumiose lint handle .sjsx as they handle .stsx, with tests
<!-- AC:END -->
