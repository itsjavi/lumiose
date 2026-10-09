---
id: TASK-119
title: 'Check-time LUM4002: island props must be serialisable'
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:34'
labels:
  - tooling
  - types
dependencies: []
priority: medium
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 5. <Counter client:load onDone={() => …} /> passes lumen check and lumen build and fails with a 500 at request time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen check / LSP report LUM4002 for client:* call-site props whose type is not serialisable (functions, class instances, symbols…), via the shadow TSX types or a compiler check
- [x] #2 Tests; errors/LUM4002.md describes the check-time behaviour
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): type-level check in lumen/jsx-runtime. JSX.LibraryManagedAttributes: a component whose props all serialize takes P & IslandDirectives (unchanged errors); otherwise a union discriminated by the directive, (P & no directives) | (IslandProps<P> & directives). IslandProps maps each prop: functions/symbols/promises -> NotSerializable<"a function"> marker (only undefined fits), arrays/maps/sets/objects recursively (array/Map syntax in the alias so recursive types like JSX.ClassValue stay deferred), slots (types JSX.Element is assignable to), unknown and any kept. Intrinsic element props carry a symbol brand so LMA leaves them alone (TS calls LMA for intrinsic contextual types; without it hovers lost docs). lumen check (cli/check/island-props.ts) and the language server (islandPropDiagnostics) rewrite TS errors carrying the marker to LUM4002 on the prop, with path (`images.load` is a function). Limitation: a component with non-serializable declared props, used without a directive and missing a required prop, gets TS's union message without the 'Property x is missing' elaboration. Values TS cannot see (method-less class instances, cycles, unknown) stay runtime-only. Tests: jsx fixtures (accepted/rejected), island-props.test.ts (unit + lumen check on fixture), LSP test (.stsx and .tsx). pnpm typecheck (all examples) clean; lumen tests 828 pass; language-server 55 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM4002 at check time: island call sites type their props as serializable (lumen/jsx-runtime LibraryManagedAttributes); lumen check and the LSP report the TypeScript error as LUM4002 on the prop. errors/LUM4002.md documents it.
<!-- SECTION:FINAL_SUMMARY:END -->
