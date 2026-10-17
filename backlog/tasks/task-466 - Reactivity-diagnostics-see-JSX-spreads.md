---
id: TASK-466
title: Reactivity diagnostics see JSX spreads
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-16 22:50'
updated_date: '2026-10-17 00:13'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 464000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-347 and TASK-349 (Photon, 2026-10-17). The analyzer counts identifiers in JSX expression containers as JSX references, but not spread arguments: `const attrs = { title: props.title }; <div {...attrs} />` reports no LUM2001, although the spread reads attrs once. And since TASK-347, `<span {...props} />` without content inserts props.children, but LUM2005 (children inserted twice) does not count that insert next to a written {props.children}.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A stale derived value that reaches JSX only through a spread attribute reports LUM2001
- [x] #2 The children insert of an element with a props spread and no content counts for LUM2005
- [x] #3 Compiler tests cover both
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17 (branch claude/photon-bugs-2c1927, main merged at 8f1d1344).
LUM2001: the analyzer now treats JSX spread attributes and spread children like {…} containers (jsx_depth), so `const attrs = { title: props.title }; <div {...attrs} />` and `<Card {...extra} />` report. Live forms (a function called in the spread) and the TASK-349 constant APIs stay quiet.
LUM2005: an intrinsic element without content whose spread is the props object, or a rest that still carries children, counts as a children insert at the spread (analyzer `spread_children_insert`, the same takes_markup and has_content rules as the codegen, now shared from codegen::client). PropsSymbols tracks the rests whose pattern took children out (`rest_without_children`); a later `children` attribute cancels the insert.
Tests: golden spread-diagnostics.tsx (two LUM2001, one LUM2005; a rest without children, written content, a later children attribute and a void element report none). spread-defaults now warns for its `const attrs = props.attrs` used only in a spread, which is stale (expected).
Scan of the repo's .tsx/.stsx (client target): the only new reports are three setup-time objects in @lumiose/ui that are only spread (Combobox.List popover, NumberField.Input spin, Popover.Trigger hover): follow-up TASK-477 for Halo. Docs: errors/LUM2001.md (spreads count; live and untrack forms), errors/LUM2005.md (the spread insert).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2001 now sees values used through a spread (on elements and components), and LUM2005 counts the children an element's props spread inserts (TASK-347), unless a rest took children out or a later children attribute replaces them. Golden test spread-diagnostics; LUM2001 and LUM2005 docs updated. The three @lumiose/ui objects this surfaced are marked as initial values with untrack (no behaviour change) so ui's compile-cleanly test stays green; TASK-477 (Halo) decides whether they should be live. pnpm check and ui-e2e green.
<!-- SECTION:FINAL_SUMMARY:END -->
