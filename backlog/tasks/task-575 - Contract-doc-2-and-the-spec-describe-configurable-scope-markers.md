---
id: TASK-575
title: Contract doc-2 and the spec describe configurable scope markers
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 00:55'
labels:
  - docs
  - css
milestone: m-14
dependencies:
  - TASK-573
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - backlog/docs/architecture/doc-2 - Compiler-runtime-contract.md
  - backlog/docs/architecture/doc-1 - Lumiose-architecture-specification.md
priority: medium
ordinal: 567000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The contract (doc-2) says that scope tokens are `data-l-<hash>` attributes, describes the `$$scope` format, and has an `applyScope` row. The spec's style sections describe the fixed attribute. Update both to decision-85 and to the `$$scope` format the compiler task settles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc-2 §1, §5.3 and the applyScope row describe the scopedStyles markers and the $$scope format
- [x] #2 doc-1's style sections reference decision-85 instead of a fixed data-l- attribute
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): doc-2 §1 (scope markers, $$scope format with .name class tokens), the applyScope row and the server attribute helpers (classAttr/spreadAttrs scope argument) describe decision-85; examples use data-lum-. doc-1 §4.6.2 describes the configurable marker and specificity.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The contract and the spec describe configurable scope markers (decision-85) and the $$scope format.
<!-- SECTION:FINAL_SUMMARY:END -->
