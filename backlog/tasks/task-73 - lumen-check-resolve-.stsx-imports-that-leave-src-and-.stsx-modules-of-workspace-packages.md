---
id: TASK-73
title: >-
  lumen check: resolve .stsx imports that leave src/ and .stsx modules of
  workspace packages
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 21:20'
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
- [ ] #1 Relative imports that leave src/ from .stsx files type-check (e.g. shadow emission rewrites such specifiers relative to the shadow file, or an equivalent)
- [ ] #2 A Lumen project type-checks .stsx modules imported from workspace packages (e.g. lumen check shadows linked packages' .stsx, or libraries ship declarations) without hand-written rootDirs; the site-kit showcase drops its kit.ts and rootDirs workaround
- [ ] #3 Covered by check tests; docs updated (reference/cli or concepts/components)
<!-- AC:END -->
