---
id: TASK-423
title: 'Docs demos: a component with only a function prop is an island'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:39'
updated_date: '2026-10-16 04:27'
labels:
  - docs
  - web
milestone: m-12
dependencies: []
priority: low
ordinal: 421000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-405 (2026-10-16). apps/web's ui:demos generator does not treat an example whose only client need is a function prop (for example `validate=`) as an island, so the live demo renders without it. Halo worked around it in field.md's example.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The generator hydrates such an example as an island, or the docs contract rejects it with a clear message
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Beacon): apps/web/src/content/ui-demos.ts `needsIsland(code)`: besides the runtime import, `bind:` and events, an example is an island when it passes a function prop, written in place (`validate={(value) => …}`) or by the name of a lowercase function it declares (`validate={available}`, `function available` or `const available = (…) =>`). `get…` props (`getAriaValueText`) stay server HTML, as formatters that also run on the server, and so do capitalized names (components). The only generated change from the rule alone was Meter's StorageMeter (getAriaValueText), which the `get…` exception keeps static. field.md's async example drops Halo's workaround (the `signal` and `bind:value` that made it an island): it reads `state.value` in Field.Validity and renders its own <p> (TASK-415), and stays an island through `validate={available}`. Test: ui-demos.test.ts 'hydrate an example whose only client need is a function prop (TASK-423)'. Checked in apps/web dev (/ui/field): the demo hydrates, 'admin' shows 'That handle is taken.', 'ada' shows 'ada is free.'. Checks: apps/web vitest (35 passed), packages/cli docs tests (ui, examples), @lumiose/ui tests (317 passed), ui docs:check.
<!-- SECTION:NOTES:END -->
