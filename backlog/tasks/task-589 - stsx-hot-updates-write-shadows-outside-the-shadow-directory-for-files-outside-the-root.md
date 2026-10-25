---
id: TASK-589
title: >-
  stsx hot updates write shadows outside the shadow directory for files outside
  the root
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 03:02'
updated_date: '2026-10-25 03:14'
labels:
  - stsx
  - bug
milestone: m-14
dependencies: []
priority: low
ordinal: 581000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.8.0 delta security review, non-security bug (local only, no attacker). In dev, the stsx plugin's hotUpdate writes or removes the shadow of every changed `.stsx` file (packages/stsx/src/index.ts:288-293), and shadowPathFor (packages/stsx/src/typegen.ts:49-51) joins the shadow directory with the path relative to the root. For a `.stsx` file outside the root (a linked workspace package, which load watches with addWatchFile), the relative path starts with `../`, so the shadow lands outside the shadow directory, for example `<root>/packages/ui/src/X.stsx.tsx` or beyond the root, and deleting the source removes the file at that path. syncShadows only walks the root, so `stsx typegen` never writes such shadows.

Fix: skip files outside the root in writeShadow and in the hotUpdate removal (or give them a path inside the shadow directory), with a test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A changed or deleted .stsx file outside the root writes or removes nothing outside the shadow directory, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux, solo takeover): shadowPathFor returns undefined for a file outside the root (a relative path that starts with .. or is absolute); writeShadow and the hotUpdate removal skip such files. Test in src/typegen.test.ts: a change event for a linked file next to the project writes nothing at the stray path, and an unlink leaves a file at that path alone (red before the fix). Docs: type-checking.md says only files under the root get shadows.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shadows are written and removed only for .stsx files under the project root; a linked package's file gets none, instead of a stray file outside the shadow directory. Tested in packages/stsx/src/typegen.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
