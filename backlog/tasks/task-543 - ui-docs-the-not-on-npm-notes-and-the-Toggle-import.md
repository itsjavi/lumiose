---
id: TASK-543
title: 'ui docs: the not-on-npm notes and the Toggle import'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
labels:
  - ui
  - docs
dependencies: []
priority: medium
ordinal: 536000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). The published README.md and installation.md still say @lumiose/ui is not on npm yet. toggle-group.md imports Toggle from @lumiose/ui/toggle-group, which does not export it (it comes from @lumiose/ui/toggle).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md and installation.md describe installing from npm
- [x] #2 toggle-group.md's examples import Toggle from @lumiose/ui/toggle, and a docs test type-checks them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (commits 87669c83, 161269dd). packages/ui/README.md, docs/installation.md and docs/README.md say the package is on npm (install with pnpm add). toggle-group.md (Toggle), and also checkbox-group.md (Checkbox, Fieldset) and radio-group.md (Fieldset), named entries that do not export those parts; their header comments now list the right entries, and Toggle Group's tsx check example imports from @lumiose/ui/toggle and @lumiose/ui/toggle-group, which packages/cli's docs examples test type-checks. New packages/ui/src/docs-imports.test.ts checks every page's imports and the entries their comments name, and the stylesheets they import (fails on the old pages). apps/web's generated toggle-group demo regenerated (pnpm --filter @lumiose/web ui:demos). Left as is: packages/create's --ui refusal still says @lumiose/ui is not on npm when the release does not offer it (Beacon's area, conditional).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The ui docs describe installing from npm, and every page's imports name entries that export them; Toggle Group's example imports Toggle from @lumiose/ui/toggle, type-checked by the docs examples test, and a ui docs test checks every page's imports.
<!-- SECTION:FINAL_SUMMARY:END -->
