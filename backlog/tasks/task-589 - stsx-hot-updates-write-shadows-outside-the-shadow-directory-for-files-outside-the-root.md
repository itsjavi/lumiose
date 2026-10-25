---
id: TASK-589
title: >-
  stsx hot updates write shadows outside the shadow directory for files outside
  the root
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 03:02'
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
- [ ] #1 A changed or deleted .stsx file outside the root writes or removes nothing outside the shadow directory, with a test
<!-- AC:END -->
