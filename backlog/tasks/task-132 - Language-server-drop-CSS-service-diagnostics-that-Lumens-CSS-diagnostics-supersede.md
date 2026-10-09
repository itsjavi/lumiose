---
id: TASK-132
title: >-
  Language server: drop CSS-service diagnostics that Lumen's CSS diagnostics
  supersede
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-09 04:30'
updated_date: '2026-10-09 04:45'
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
- [x] #1 Where a LUM3014/LUM3017/LUM3020 diagnostic covers the same declaration or brace, the CSS service's duplicate is not published
- [x] #2 server.test.ts expectations updated (Broken.stsx: LUM3017 only for 'color: ;')
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: cssDiagnostics(snapshot, lumen) drops the CSS service's unknownProperties / css-propertyvalueexpected (same line as LUM3020 / LUM3017) and css-rcurlyexpected (any LUM3014 in the same block). Tests: Broken.stsx expectations (LUM3017 only), push-mode codes, new Dupes.stsx test (verified failing without the filter).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The language server no longer shows CSS-service duplicates of LUM3014/LUM3017/LUM3020.
<!-- SECTION:FINAL_SUMMARY:END -->
