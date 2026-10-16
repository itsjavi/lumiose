---
id: TASK-411
title: 'UI authoring guidance: JSX props set custom-element properties'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 00:24'
updated_date: '2026-10-16 01:27'
labels:
  - ui
  - docs
milestone: m-12
dependencies:
  - TASK-375
priority: low
ordinal: 410000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-375 (2026-10-16). The runtime sends a JSX prop to the custom element's property of the same name. A read-only getter with that name, such as `min` on `lu-number-field`, makes hydration throw. Record the rule wherever @lumiose/ui's authoring conventions live (the docs structure or a contributor note): a `lu-` element's getters either have setters or don't share a name with a prop the component renders. Consider a dev-time check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The rule is documented where component authors read it
- [x] #2 A test or dev warning catches a read-only getter shadowed by a rendered prop, or its absence is recorded with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, batch 7): done in 7833c3ec.

- The rule is written in two places:
  - **packages/ui/README.md**, a new "Writing a component" section that points to decision-62 and decision-64: a `lu-` element's getters have setters, or no prop shares their name; read an attribute the component renders through a private getter (`get #min()`) or another name.
  - **packages/lumiose/docs/guides/web-components.md** ("Properties and attributes"): a read-only property cannot take a prop, the assignment throws and the island fails to hydrate. The note is for any element author. llms-full is regenerated.
- The check is `packages/ui/src/elements.dom.test.ts` (happy-dom):
  - It imports every `*.script.ts`, lists each defined `lu-*` element's getters without setters up to HTMLElement, and scans every component's JSX for the attributes written on its `<lu-…>` tags (a small scanner that skips braces, strings and spreads). It fails on a clash.
  - It caught a planted `status="x"` on `<lu-avatar>`.
  - Limitation: props that reach the tag through a spread (`{...rest}`) are not seen, and the README says so.
  - A runtime dev check was not added: Chrome's TypeError ("Cannot set property min of … which has only a getter") already names the property, and the test catches it in CI before an author ships it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The getter rule is in @lumiose/ui's README and the web components guide; elements.dom.test.ts checks every lu- element's read-only properties against the attributes its component writes (7833c3ec). Checks: pnpm check (2334 tests), pack:check --smoke --skip-npm (@lumiose/ui 128 files), ui-e2e 646 passed (18 skipped), apps/web 171 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
