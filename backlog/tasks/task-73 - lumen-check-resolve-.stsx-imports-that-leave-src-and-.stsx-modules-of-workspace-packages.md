---
id: TASK-73
title: >-
  lumen check: resolve .stsx imports that leave src/ and .stsx modules of
  workspace packages
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 21:40'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59). Shadow type checking breaks in two cases that work in Vite:

1. A .stsx file importing a relative path that leaves src/ (e.g. showcase/src/Showcase.stsx importing '../../src/index.ts') fails with TS2307. The shadow sits at .lumen/shadow/src/Showcase.stsx.tsx, so TS resolves the specifier from there (.lumen/src/index.ts), and rootDirs only remaps candidates that fall inside a root dir. Plain .ts/.tsx files are unaffected.
2. A project that imports .stsx components from another package (apps/web importing @lumen/site-kit, whose src/index.ts re-exports './Button.stsx') fails with TS2307: the library's shadows are not in the consumer's rootDirs, and nothing generates them.

Current workarounds (packages/site-kit): the showcase routes its imports through a plain src/kit.ts, and its tsconfig adds '../src' and '../.lumen/shadow/src' to rootDirs after 'lumen check' has run at the kit root (script: 'lumen check && lumen check --root showcase'). TASK-57 and TASK-58 will hit case 2 when they consume @lumen/site-kit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relative imports that leave src/ from .stsx files type-check (e.g. shadow emission rewrites such specifiers relative to the shadow file, or an equivalent)
- [x] #2 A Lumen project type-checks .stsx modules imported from workspace packages (e.g. lumen check shadows linked packages' .stsx, or libraries ship declarations) without hand-written rootDirs; the site-kit showcase drops its kit.ts and rootDirs workaround
- [x] #3 Covered by check tests; docs updated (reference/cli or concepts/components)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Derive the shadow layout from the tsconfig's rootDirs: the pair (.lumen/shadow/p, B/p) gives mirror base B; shadow of F = .lumen/shadow/<F rel B>.tsx. The template pair (src) keeps today's paths.
2. Generate .lumen/tsconfig.generated.json (not tsconfig.json: editors would adopt it as the shadows' project) with rootDirs [common dir of root + used Lumen packages, ./shadow]; projects extend it.
3. Shadow used packages' .stsx (linked deps listing lumen, transitively; plus the enclosing package of a project without package.json), skipping nested projects.
4. check: scanner/compiler diagnostics for own files only; LUM6001 when rootDirs leave a used package's .stsx out. LSP: layout-aware URI mapping, consumer copies re-synced, re-sync on tsconfig/package.json changes.
5. Write the generated tsconfig in dev/build (cli/app.ts) and lumen/vite configResolved (Lux-approved edit in Photon's file).
6. Showcase drops kit.ts and rootDirs; docs + tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: rootDirs is one merged virtual directory, so per-package pairs are impossible; a single mirror pair whose base contains every shadowed source is the only stock-TS way (verified on TS 7.0.2 in scratch). The default template is unchanged; switching the template to extends the generated config is a DX proposal for the user (fresh clones need lumen to write the file first; dev/build/vite/LSP/check/typegen do).
Note for Photon: lumen/vite configResolved now calls writeLumenTsconfig(root) from cli/check/layout.ts (commit cdb1026, approved by Lux). layout.ts re-implements the linked-package walk of vite/packages.ts without importing vite (CLI startup); keep the two rules in step.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen check and the language server now place shadows by the tsconfig's rootDirs pair. A tsconfig that extends the generated .lumen/tsconfig.generated.json mirrors the common directory of the project and its Lumen packages, so .stsx imports may leave src/ and the .stsx modules of linked workspace packages (@lumen/site-kit) type-check, with errors mapped to the package sources. LUM6001 warns when rootDirs leave a used package's .stsx out. The site-kit showcase dropped kit.ts and its rootDirs workaround. Tests: cli/check/layout.test.ts (TS 7 end to end: workspace package, package error mapping, showcase import outside src, warning), LSP mapping test. Docs: reference/jsx (Imports outside src/), reference/cli, getting-started, concepts/compiler. Commits 048e750, cdb1026, 005a99f.
<!-- SECTION:FINAL_SUMMARY:END -->
