---
id: TASK-132
title: >-
  Language server: drop CSS-service diagnostics that Lumen's CSS diagnostics
  supersede
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-09 04:30'
labels:
  - tooling
  - css
dependencies: []
ordinal: 132000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-120. lumen_css now reports unknown properties (LUM3020), empty values (LUM3017) and an unclosed { (LUM3014). vscode-css-languageservice validation reports the same problems (css-unknownproperty lint, css-propertyvalueexpected, css-rcurlyexpected), so the editor shows them twice. server.test.ts currently expects both for 'color: ;' in Broken.stsx.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Where a LUM3014/LUM3017/LUM3020 diagnostic covers the same declaration or brace, the CSS service's duplicate is not published
- [ ] #2 server.test.ts expectations updated (Broken.stsx: LUM3017 only for 'color: ;')
<!-- AC:END -->
