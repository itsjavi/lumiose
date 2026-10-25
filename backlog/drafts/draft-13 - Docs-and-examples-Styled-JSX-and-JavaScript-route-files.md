---
id: DRAFT-13
title: 'Docs and examples: Styled JSX and JavaScript route files'
status: Draft
assignee:
  - '@Beacon'
created_date: '2026-10-25 04:12'
updated_date: '2026-10-25 04:35'
labels:
  - sjsx
  - docs
milestone: m-15
dependencies:
  - DRAFT-7
  - DRAFT-9
  - DRAFT-10
  - DRAFT-11
  - DRAFT-12
priority: medium
ordinal: 592000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-88: docs and examples for Styled JSX and JavaScript route files. The docs keep TypeScript examples apart from one section per guide (decision-88, out of scope).

- **STSX docs** (packages/stsx/docs) and README:
  - the landing names both Styled TSX and Styled JSX, and says early that it is not Vercel's styled-jsx;
  - the installation page covers JavaScript projects;
  - type checking covers `allowJs`/`checkJs` and `.sjsx.jsx` shadows.
- **Lumiose docs** (packages/lumiose/docs):
  - routing lists the JavaScript route file names;
  - components and styles mention `.sjsx`;
  - the TypeScript page covers JavaScript projects and route types through JSDoc;
  - the editor and formatting pages list `.sjsx`.
- **Examples:** a JavaScript React example (`examples/stsx-react-js`) and a JavaScript Lumiose example, both with smoke tests.
- **Site:** the STSX section and the llms files are regenerated; docs:gen, docs:check and the docs tests pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The STSX and Lumiose docs cover Styled JSX and JavaScript route files, and say that Styled JSX is not Vercel's styled-jsx
- [ ] #2 A JavaScript React example and a JavaScript Lumiose example have smoke tests; docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
