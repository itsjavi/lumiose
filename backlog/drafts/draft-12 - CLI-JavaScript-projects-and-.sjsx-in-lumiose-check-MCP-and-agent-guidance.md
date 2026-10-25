---
id: DRAFT-12
title: 'CLI: JavaScript projects and .sjsx in lumiose check, MCP and agent guidance'
status: Draft
assignee:
  - '@Beacon'
created_date: '2026-10-25 04:12'
updated_date: '2026-10-25 04:35'
labels:
  - sjsx
  - cli
milestone: m-15
dependencies:
  - DRAFT-6
  - DRAFT-8
  - DRAFT-9
priority: medium
ordinal: 591000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: the CLI and its tools support JavaScript projects and `.sjsx` (packages/cli).

- **`lumiose check`** (check/shadow.ts, tsconfig.ts, project-checks.ts, index.ts):
  - writes `.sjsx.jsx` shadows;
  - type-checks JavaScript files when the project sets `checkJs`, and reports the compiler's diagnostics for `.sjsx` either way;
  - the project-wide checks (LUM3012 and the others) read `.sjsx` and `.jsx` files.
- **MCP tools** (mcp/source.ts, index.ts): component, route and compiler-output tools accept `.sjsx`.
- **Agent guidance** (agents/index.ts): says `.sjsx` is Styled JSX and how JavaScript route files are named.
- **`lumiose routes`** and other commands that print file names show JavaScript route files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose check writes .sjsx.jsx shadows, type-checks JavaScript with checkJs, and runs the project-wide checks over .sjsx and .jsx
- [ ] #2 MCP tools and agent guidance cover .sjsx and JavaScript route files
<!-- AC:END -->
