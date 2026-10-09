---
id: TASK-127
title: Route-literal type helpers and inferred action types (decision-26 §1)
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:26'
updated_date: '2026-10-09 04:55'
labels:
  - types
  - app
  - dx
dependencies: []
priority: medium
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §1: PageProps<P>, LayoutProps<P>, RequestContext/ActionContext/Action/Endpoint<P> by route pattern; actionData<typeof actions>() and submit<typeof actions.x>() inferred. Lux authorises edits in packages/lumen/src/app/{typegen,routes,server,actions}/** types and in all examples/templates for this task; coordinate with Spark (TASK-118 touches app/actions) through task notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Types per decision-26 §1, checked against the typegen route table (unknown pattern = type error); RouteProps and params-object generics removed
- [x] #2 actionData/submit infer data and fail() data from the actions export; type tests (expectTypeOf) cover success, failure, unknown action
- [x] #3 All examples, create-lumen templates, docs and the AGENTS.md section use the new helpers; lumen check clean on every example
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): registry.ts: PageProps<P> (page patterns), LayoutProps<P> ({ params, children }, layout patterns from the new typegen LayoutMap: URL scope of each _layout dir), PageRoutes/EndpointRoutes/LayoutRoutes constraints; RouteProps removed. context.ts: RequestContext<P = never>, ActionContext<P>, Endpoint<P>, Action<P, Result> by pattern (never = untyped params for middleware/helpers); params-object generics removed. actions/types.ts: ActionsExport, ActionSuccessData<A>, ActionFailureData<A> (one level: typeof action, typeof actions, typeof actions.x); actionData()/submit() overloads in client.ts, actions/server.ts, server/scope.ts (untyped call = unknown/ActionResult; a data type argument is now a type error). Tests: actions/types.test.ts (expectTypeOf: success, failure, fail() without data, unknown action, no type arg), jsx fixtures routes.tsx (unknown/stale pattern, page vs endpoint, layout scope, old generic form), typegen tests (LayoutMap), public-api type test. Migrated: all examples (bookshelf actions now inferred, ReadingListToggle uses submit<typeof actions.toggle> via import type), create templates, apps/web, benchmarks/fullstack/apps/lumen, check fixtures, docs (routing, data-and-actions, rendering-modes, server, reference/app, reference/router) and the AGENTS.md section/skill. lumen check clean on every example (spa-dotmatrix's 2 errors are TASK-133 WIP, unrelated); create-lumen tests (check + build) pass; bookshelf lumen build passes. Open point for Lux: actionData() data has no runtime success/failure marker, so its type is the union of success and fail() data, told apart only structurally; submit() results are discriminated by type. A runtime-discriminated actionData would be an API change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Route-literal helpers (PageProps, LayoutProps, RequestContext/ActionContext/Action/Endpoint by pattern, LayoutMap typegen) and inferred action types (actionData<typeof actions>(), submit<typeof actions.x>()); examples, templates, docs and AGENTS section migrated.
<!-- SECTION:FINAL_SUMMARY:END -->
