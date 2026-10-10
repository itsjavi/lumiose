---
id: TASK-190
title: API naming audit against React and Solid vocabulary
status: Done
assignee:
  - Prism
created_date: '2026-10-10 03:33'
updated_date: '2026-10-10 18:14'
labels:
  - api
  - dx
dependencies: []
priority: high
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: the API is not intuitive because similar patterns use different names; names should reuse what users know from React and Solid, stay accurate and not mislead (decision-32). Audit every public export of lumiose, lumiose/router, lumiose/server, lumiose/dom and the app layer. Starting points: createContext (React/Solid) next to provide/inject (Vue/Angular); lifetime() returns an AbortSignal; busy(), pending(), submitting(), navigating() vs React useTransition/useNavigation and Solid isPending/useIsRouting; signal/computed/effect (Preact/Angular) vs Solid createSignal/createMemo; store() (a mutable proxy, like Valtio proxy / Vue reactive, unlike Solid createStore); resource() vs createResource; invalidate (SvelteKit) vs revalidate (React Router). Also propose the final names for the doc-6 primitives (scoped state, query, optimistic). Prism is read-only: return the findings to Lux, who records the proposal for the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Table of every public export: current name, closest known API (library + name), whether semantics match, verdict (keep / rename / document), proposed name with rationale
- [x] #2 Consistent vocabulary family chosen and justified (one style for primitives, context, in-flight state, data); invented names flagged with why no known name fits
- [x] #3 Names proposed for doc-6 primitives; migration notes (pre-1.0: rename outright or keep deprecated aliases for a release)
- [x] #4 User approves the renames before TASK-191 starts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-10 Lux: started Prism (read-only) on the audit; Lux records the proposal and asks the user.

2026-10-10 User: approved renames ship outright (breaking 0.x change with a changelog migration table, no deprecated aliases). No prior leaning on primitive names: the audit recommends the family.

2026-10-10 Lux: Prism's audit recorded as doc-7 (proposal). Waiting for the user's approval.

2026-10-10 User approved every recommendation (context <Ctx value>+useContext, getAbortSignal, query(key, fn), is* getters, flush/searchParams/render, doc-6 names, keeps), except the adapter package stays @lumiose/query. Recorded as decision-35; doc-6 and doc-7 updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit (Prism) recorded in doc-7; the user approved it on 2026-10-10 with the adapter package kept as @lumiose/query. decision-35 records the vocabulary; renames ship outright (TASK-191).
<!-- SECTION:FINAL_SUMMARY:END -->
