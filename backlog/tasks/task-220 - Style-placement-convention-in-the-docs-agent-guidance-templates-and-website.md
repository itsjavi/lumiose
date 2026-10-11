---
id: TASK-220
title: 'Style placement convention in the docs, agent guidance, templates and website'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-11 01:24'
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
- [ ] #1 concepts/styles.md leads with the file-level block shared by several components and shows and explains nested blocks with when to use each
- [ ] #2 The AGENTS.md snippet, the skill and the create-lumiose templates state and follow the convention; docs:gen has run and docs:check and the docs tests pass
- [ ] #3 Each .stsx file uses one top-level <style> at the end of the file by default; every remaining nested block scopes an element subtree or reads a component-local constant
- [ ] #4 Rendering is unchanged: tests and e2e pass, and before/after screenshots of the main pages match (watch for selectors that now reach other components in the same file)
<!-- AC:END -->
