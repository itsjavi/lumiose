---
id: TASK-528
title: 'apps/web: UiDemo gets a LUM2003 warning since decision-77'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-23 09:31'
updated_date: '2026-10-23 19:15'
labels: []
dependencies: []
priority: low
ordinal: 521000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-523 (decision-77), LUM2003 warns on early returns whose condition reads props. apps/web/src/ui-demos/index.tsx's UiDemo now gets that warning. Restructure it (branch in JSX) or confirm the warning is right and silence it the documented way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumiose check reports no LUM2003 in apps/web
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (0.6.1 cleanup): the generator (apps/web/src/content/ui-demos.ts) now writes UiDemo as `return <>{demoById(props.id)}</>` with the switch in a lowercase helper, so the branch is a JSX expression that follows props.id (a real fix, not a silenced warning). A server compile of the regenerated index.tsx still emits the 29 island() call sites. lumiose check on apps/web: no problems; apps/web vitest green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
UiDemo branches in its JSX: the generated src/ui-demos/index.tsx returns `<>{demoById(props.id)}</>` and the switch moved to a plain helper, so LUM2003 no longer fires and the demo follows a changing id. Generator in apps/web/src/content/ui-demos.ts, output regenerated with `pnpm --filter @lumiose/web ui:demos`. Verified: `lumiose check` on apps/web reports no problems, apps/web tests pass, the server compile keeps all island call sites.
<!-- SECTION:FINAL_SUMMARY:END -->
