---
id: TASK-220
title: 'Style placement convention in the docs, agent guidance, templates and website'
status: Done
assignee:
  - Beacon
created_date: '2026-10-11 01:24'
updated_date: '2026-10-11 01:52'
labels:
  - docs
  - styles
  - dx
milestone: m-5
dependencies: []
priority: high
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-40 (user 2026-10-11): teach and use one top-level <style> at the end of the file by default, shared by every component in it; nested blocks only to scope one element's subtree or to read a component-local $constant. The docs show and explain both placements. Today every teaching surface nests <style> inside components (create-lumiose templates 9 of 9 files, the website 11 of 11, the styles page 6 of 7 samples), so authors and agents copy it. Update: concepts/styles.md leads with the file-level block (several components sharing it, constants declared before it) and then explains nested blocks and when to use them; components.md, getting-started.md and the reference samples follow; the AGENTS.md snippet and skill written by `lumiose agents init` and create-lumiose state the convention; the create-lumiose templates, apps/web, apps/playground (including its default sample) and the landing's Counter sample (content/samples.ts, two components sharing one block) use it. Regenerate the docs and llms.txt. No lint rule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 concepts/styles.md leads with the file-level block shared by several components and shows and explains nested blocks with when to use each
- [x] #2 The AGENTS.md snippet, the skill and the create-lumiose templates state and follow the convention; docs:gen has run and docs:check and the docs tests pass
- [x] #3 Each .stsx file uses one top-level <style> at the end of the file by default; every remaining nested block scopes an element subtree or reads a component-local constant
- [x] #4 Rendering is unchanged: tests and e2e pass, and before/after screenshots of the main pages match (watch for selectors that now reach other components in the same file)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon 2026-10-11:
- Docs: concepts/styles.md leads with a file-level block shared by Counter + Reset (top-level constants before it), then the placement table (file level first), then 'Nested blocks, for two jobs' (scope one subtree; read a component const) with the Panel sample and a warning about widened scope. Example section: Card + Dashboard share one file-level block; the nested block remains only to read Dashboard's local const. API table and two common mistakes updated. components.md, getting-started.md, islands.md, svg.md and routing.md samples moved to file-level blocks (compiler.md's Box keeps a nested block: it reads a component const). Meter in 'JS values' keeps its nested block (reads component const). llms.txt/llms-full.txt regenerated.
- Agent guidance: the AGENTS.md snippet (.stsx section) and the skill (Styles bullet) written by lumiose agents init / create-lumiose state the convention and when to nest.
- create-lumiose: all 9 template files moved to one top-level <style> (plus the layouts' <style global>) at the end; the minimal template carries a one-line comment stating the convention. Note: in the ssr template's index.stsx, .count now also styles GuestCount's <p> (it was outside Home's JSX, so it was unstyled before), which matches the intent.
- apps/web: all 11 files moved; Showcase.stsx (ShowcaseGrid + PageHead) and routes/index.stsx (Icon + Home) merged into one block each. Widening checked: Showcase's bare p rule now reaches PageHead's .kicker, whose own rule overrides margin and color; Icon's <style> was a native SVG block (unscoped) and is now file-scoped .icon (Callout and Card icons set their own rules). Landing Counter sample (content/samples.ts) is now Counter + Reset sharing one block; counterOutput/counterCss regenerated with the compiler and the content test passes. Landing bullet 'Scoped by placement' reworded.
- apps/playground: Playground.stsx and routes/index.stsx moved; samples: Counter (default) now Counter + Reset sharing one block, Todos hoisted, 'Scoped styles' shows the file-level block for Card + Badge and one nested block scoping a <footer> subtree.
- Rendering: full-page before/after screenshots (light/dark, 1280/390) of /, /examples, /benchmarks, /benchmarks/js-framework-benchmark, docs pages, /errors, 404 and the playground: pixel-identical except the intended Counter sample/copy on the landing (the rest only shifted; residual row diffs are sub-pixel resampling, checked visually), /errors (LUM5006 added by Nova's in-flight TASK-216) and the playground editor/preview content (new sample). Evidence: backlog/assets/task-220-landing-counter-before-after.png, task-220-playground.png, task-220-docs-styles.png.
- Checks: docs:gen, docs examples type-check + docs tests, vitest (cli agents, create incl. check+fmt+build of a scaffold, web content, playground), lumiose check (web, playground), oxlint, oxfmt, web e2e 9 passed, playground e2e 4 passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Style placement convention (decision-40) taught and applied: styles.md leads with the file-level block and explains nested blocks; agent snippet, skill and create-lumiose templates state and follow it; apps/web, apps/playground and the landing Counter sample (Counter + Reset sharing one block) use it. Rendering unchanged per before/after screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
