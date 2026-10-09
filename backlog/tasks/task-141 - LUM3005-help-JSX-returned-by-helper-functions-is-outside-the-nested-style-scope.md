---
id: TASK-141
title: >-
  LUM3005 help: JSX returned by helper functions is outside the nested style
  scope
status: Done
assignee:
  - Photon
created_date: '2026-10-09 05:10'
updated_date: '2026-10-09 05:14'
labels:
  - compiler
  - css
  - diagnostics
dependencies: []
priority: low
ordinal: 141000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-133 (Chime): a component-local helper returning JSX (const field = () => <label class="field">…) is not under the component's nested <style> subtree, so its classes get no styles; LUM3005 warns but its help does not explain why. Whether helper JSX should count as in scope is a syntax/DX question for the user (decision-23); this task only improves the help text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LUM3005 help names the helper-function case and suggests a top-level <style> block or rendering the JSX inside the styled element; docs/errors/LUM3005.md and styles.md common mistakes updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): LUM3005 help (lumen_css selector.rs, Halo's crate, assigned to me by Lux) now names the helper-function case: JSX returned by a helper (const field = () => <label class="field">) is not inside a nested <style>'s element; move the block to the top level of the file or render that JSX inside the styled element. Fixture unused.out updated. Docs: errors/LUM3005.md (example + fix), concepts/styles.md common mistakes. No scoping change (decision-23 question stays with the user).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM3005 help and docs explain that helper-function JSX is outside a nested style block's subtree and suggest a top-level block or inline JSX.
<!-- SECTION:FINAL_SUMMARY:END -->
