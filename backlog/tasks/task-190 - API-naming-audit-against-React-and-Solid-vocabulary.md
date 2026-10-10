---
id: TASK-190
title: API naming audit against React and Solid vocabulary
status: To Do
assignee:
  - Prism
created_date: '2026-10-10 03:33'
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
- [ ] #1 Table of every public export: current name, closest known API (library + name), whether semantics match, verdict (keep / rename / document), proposed name with rationale
- [ ] #2 Consistent vocabulary family chosen and justified (one style for primitives, context, in-flight state, data); invented names flagged with why no known name fits
- [ ] #3 Names proposed for doc-6 primitives; migration notes (pre-1.0: rename outright or keep deprecated aliases for a release)
- [ ] #4 User approves the renames before TASK-191 starts
<!-- AC:END -->
