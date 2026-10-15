---
id: TASK-339
title: 'CSS compiler: accept Tailwind v4 at-rules in style blocks without LUM3015'
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 06:40'
updated_date: '2026-10-15 08:09'
labels:
  - css
  - compiler
  - tailwind
milestone: m-11
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
- [x] #1 A style block with @reference and @apply compiles without LUM3015 in dev, build, check and the language server; the at-rules reach Tailwind's plugin unchanged and scoped selectors still get their token
- [x] #2 Other unknown at-rules still report LUM3015
- [x] #3 examples/ssr-styles-e2e builds and lumiose check reports no warnings; concepts/styles.md drops the LUM3015 caveat
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux): found by TASK-336's smoke test; placed in M11 and assigned to Halo (lumiose_css diagnostics).

2026-10-15 (Halo): claimed in worktree branch claude/halo-m11-ec4bcd.

2026-10-15 (Halo): implemented in lumiose_css (crates/lumiose_css/src/process.rs). Lightning CSS already kept unknown at-rules verbatim (as CssRule::Unknown, raw tokens) and scoped the selectors around them; only its "Unknown at rule" warning (ParserError::AtRuleInvalid) became LUM3015. Now that warning is dropped for Tailwind v4 names: @apply, @reference, @theme, @utility, @variant, @custom-variant, @slot (the placeholder inside a @custom-variant body, added to the list), @source, @plugin, @config. Exact, case-sensitive match, as Tailwind matches them (@APPLY still warns).
Decision: always on, no Tailwind detection. The compiler has no view of the project dependencies, and detection would need a new option through napi, @lumiose/vite, lumiose check and the language server (four areas) for little gain: these names are Tailwind-specific, and without Tailwind a browser ignores them like any unknown at-rule. All four hosts call lumiose_css, so dev, build, check and the editor agree.
Not changed: the pre-pass already treats the bodies of these at-rules as descriptor blocks (no scoping, no LUM3020), and @apply x:y statements are not taken for declarations. Lightning CSS normalises tokens inside an unknown at-rule block (oklch(0.72 …) prints as oklch(72% …)), which is equivalent CSS.
Limitation (no user path today): with cssTargets that lower nesting, Lightning CSS keeps @apply in its rule before the declarations that follow it, but moves a nested @variant block ahead of declarations written before it. cssTargets is only a compiler API option; @lumiose/vite does not pass it.
Tests: fixtures tests/fixtures/tailwind.stsx (all ten at-rules at top level and nested, scoped selectors, @made-up-rule, @frobnicate and @APPLY still LUM3015) and tailwind_lowered.stsx (chrome 100 targets, minified).
Docs: concepts/styles.md (Tailwind section: example block, the list, no LUM3015 caveat), errors/LUM3015.md, llms-full.txt regenerated. Example comment in examples/ssr-styles-e2e/src/routes/about/page.stsx updated (Nova area, comment only).
Validation: cargo test -p lumiose_css --all-features ok; examples/ssr-styles-e2e: lumiose check "No problems found", lumiose build without warnings (.applied[data-l-…] gets padding, font-weight, margin and border from Tailwind), Playwright 10/10 (dev and build); docs:gen + docs:check ok.
<!-- SECTION:NOTES:END -->
