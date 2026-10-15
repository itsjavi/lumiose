---
id: TASK-339
title: 'CSS compiler: accept Tailwind v4 at-rules in style blocks without LUM3015'
status: To Do
assignee: []
created_date: '2026-10-15 06:40'
labels:
  - css
  - compiler
  - tailwind
dependencies:
  - TASK-336
references:
  - packages/lumiose/docs/concepts/styles.md
  - examples/ssr-styles-e2e/src/routes/about/page.stsx
priority: low
ordinal: 341000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by TASK-336's smoke test (examples/ssr-styles-e2e). With @tailwindcss/vite, Tailwind's @reference, @apply, theme() and --spacing() work inside scoped style blocks: Lumiose's compiler keeps the unknown at-rules, scopes the selectors, and Tailwind's plugin then processes the block's CSS module (page.stsx?lumiose&type=style&lang.css). But the compiler reports every @reference and @apply as LUM3015 (Unknown at rule), a warning in lumiose dev, lumiose build, lumiose check and the editor, so concepts/styles.md currently recommends utilities in markup and var() in blocks. Recognise Tailwind's at-rules (@reference, @apply, @theme, @utility, @variant, @custom-variant, @source, @plugin, @config) as pass-through: no LUM3015, kept verbatim for the next Vite plugin. Whether to do it only when Tailwind is detected is part of the task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A style block with @reference and @apply compiles without LUM3015 in dev, build, check and the language server; the at-rules reach Tailwind's plugin unchanged and scoped selectors still get their token
- [ ] #2 Other unknown at-rules still report LUM3015
- [ ] #3 examples/ssr-styles-e2e builds and lumiose check reports no warnings; concepts/styles.md drops the LUM3015 caveat
<!-- AC:END -->
