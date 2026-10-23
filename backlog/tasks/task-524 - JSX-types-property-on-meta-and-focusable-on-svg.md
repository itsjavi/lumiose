---
id: TASK-524
title: 'JSX types: property on <meta> and focusable on <svg>'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-23 08:17'
updated_date: '2026-10-23 08:40'
labels:
  - types
  - dx
milestone: m-13
dependencies: []
priority: low
ordinal: 518000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). In a custom src/document.stsx, <meta property="og:site_name" content="…" /> is a type error (property is missing from the meta element's attributes), while the <Meta property> component accepts it; the port moved its Open Graph defaults to <Meta>. focusable="false" on <svg>, common in icon components ported from React, is also a type error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 <meta property> type-checks in JSX
- [x] #2 focusable on SVG elements type-checks, or the JSX docs say why it is left out
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MetaAttributes gains property (RDFa, as Open Graph uses it) and SVGAttributes gains focusable (SVG Tiny 1.2, ignored by current browsers but common in icon markup ported from React). Fixture cases added; the JSX type tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
