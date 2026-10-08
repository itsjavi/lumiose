---
id: TASK-102
title: 'Templates and docs: tsconfig extends the generated config'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 21:59'
updated_date: '2026-10-08 22:15'
labels: []
milestone: m-5
dependencies:
  - TASK-73
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-25) that new projects' tsconfig.json extends .lumen/tsconfig.generated.json, so Lumen keeps rootDirs, includes and JSX settings in sync, including workspace .stsx packages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 create-lumen templates and lumen agents init write a minimal tsconfig.json extending ./.lumen/tsconfig.generated.json; the generated file includes everything from spec §4.7; lumen check stops warning when a project extends it
- [x] #2 Examples and apps in the repo switched where it simplifies them; docs (getting-started, reference/tsconfig or cli) updated in the same commits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Generated .lumen/tsconfig.generated.json gains every spec §4.7 option (module, moduleResolution, allowImportingTsExtensions, noEmit, strict) besides jsx/jsxImportSource/rootDirs/types/include (LUMEN_COMPILER_OPTIONS in check/layout.ts).
2. tsconfigTemplate() = { extends: './.lumen/tsconfig.generated.json' }; formatTsconfig() adds a comment; standaloneTsconfig() keeps the written-out form; LUM6001 rootDirs help recommends extends first.
3. create-lumen writes formatTsconfig(); lumen agents init writes tsconfig.json only when missing.
4. Examples switched to extends [base, generated] (dropping jsx/jsxImportSource/rootDirs); apps/web already extends.
5. Docs: reference/jsx.md tsconfig section rewritten (template, generated content, overrides, mirror base, without extends), getting-started §2, concepts/compiler.md, cli.md (check, agents init).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: done standalone after TASK-34. Evidence: check.test default fixture projects now use the extends template (28 tests, no LUM6001 on valid projects); agents tests (created when missing, untouched when present); create-lumen 20 tests incl. 'passes lumen check and builds' with the new tsconfig; lumen check --format json ok with 0 diagnostics in all 6 examples and apps/web after the switch. pnpm typecheck green, pnpm test 1025 passed, pnpm lint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
New projects' tsconfig.json is { extends: './.lumen/tsconfig.generated.json' } (with a comment): written by create-lumen, by lumen agents init when missing, and printed by lumen check when absent. The generated file now carries every spec §4.7 option. standaloneTsconfig() keeps the written-out form for projects that cannot extend; LUM6001 help recommends extending. Repo examples extend [tsconfig.base.json, generated] without their own jsx/rootDirs. Docs updated: reference/jsx.md, getting-started, concepts/compiler, cli.md.
<!-- SECTION:FINAL_SUMMARY:END -->
