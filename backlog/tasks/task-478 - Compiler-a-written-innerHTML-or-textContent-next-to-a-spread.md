---
id: TASK-478
title: 'Compiler: a written innerHTML or textContent next to a spread'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-17 00:01'
updated_date: '2026-10-17 01:34'
labels:
  - compiler
  - security
dependencies: []
priority: low
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-470 (Beacon, 2026-10-17). An element with a spread compiles every written prop into the spread object, on both targets, and since TASK-470 a spread never writes innerHTML or textContent (the server's spreadAttrs never did). So `<div {...rest} innerHTML={html} />` silently renders no HTML, on the server and the client, while the same prop without the spread works. Options: take written innerHTML and textContent out of the spread, as bind: attributes are (take_bindings), so they apply as written props on both targets; or report a diagnostic. The docs (jsx.md, security.md) currently say innerHTML works only on an element without a spread.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A written innerHTML or textContent next to a spread either works on both targets, with compiler fixtures, or reports a diagnostic
- [x] #2 jsx.md and security.md match the behaviour
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17 (Lux, orchestrator): assigned to Photon. Decided: take a written innerHTML or textContent out of the spread, as bind: attributes are (take_bindings), so it applies as a written prop on both targets. That matches how the same prop works without a spread. No new diagnostic is needed.

Photon, 2026-10-17 (branch claude/photon-bugs-2c1927, main merged at e3699b0b). Reproduced: `<div {...rest} innerHTML={html} />` compiled to spread(el, () => mergeProps(rest, { get innerHTML() … })) and spreadAttrs(mergeProps(rest, { innerHTML })), both of which drop the key, plus the TASK-347 children insert. Fix as decided: take_bindings is now take_written, which also takes a written innerHTML or textContent out of the spread (is_written_content), so it applies after the spread as on an element without one, on both targets; such an element gets no spread children insert (codegen) and no LUM2005 insert (analyzer). Tests: golden spread-content (dynamic and static, before and after the spread), hydration test 'renders innerHTML and textContent written next to a spread, then updates them' (failed before the fix: empty div and p on the server). Docs: jsx.md, security.md, doc-2. No code in the repo combines the two, so no app output changes; apps/web e2e not rerun for that reason.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A written innerHTML or textContent next to a spread now applies as written, after the spread, on the server and the client, instead of going into the spread object that drops it; it also replaces the spread's children. Golden and hydration tests; jsx.md, security.md and doc-2 updated. pnpm check and ui-e2e green.
<!-- SECTION:FINAL_SUMMARY:END -->
