---
id: TASK-393
title: Agent-ready @lumiose/ui
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 18:05'
labels:
  - ui
  - docs
  - agents
milestone: m-12
dependencies:
  - TASK-353
priority: high
ordinal: 392000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request, 2026-10-15: @lumiose/ui is agent-ready like the main lumiose package, so coding agents discover the components and know how to use and style them (decision-64).

- Move the UI pages from packages/lumiose/docs/ui to packages/ui/docs and ship them in the @lumiose/ui package (its versions differ from lumiose's, so the docs match the installed version). Keep dialog.md's sections as the component template.
- Generate and check @lumiose/ui's own llms.txt and llms-full.txt, like lumiose's docs:gen and docs:check. Every exported component has a page and an llms entry, and the examples are type-checked.
- Link the UI llms.txt from lumiose's llms.txt, with both the installed path and the site URL, and serve it on the site next to the main one.
- `lumiose docs` and the MCP docs tools find the UI pages when @lumiose/ui is installed. The MCP lists the components with their parts, props, events and styling hooks.
- `lumiose agents init` adds a UI part when the project depends on @lumiose/ui: a section in AGENTS.md and a UI skill covering composition, bind:, events, styling (unstyled, the lu.core and lu.theme layers, state selectors, --lu- variables) and the accessibility rules a user must keep.
- create-lumiose offers @lumiose/ui as an option: a prompt plus a flag that adds the dependency, the stylesheet and theme imports, and the UI agent files. The option goes live when @lumiose/ui is public (TASK-389).
- Every prop of every part carries a JSDoc comment, so editors and agents read it from the types.

Record the proposed public names (flag, skill name, paths, MCP tool names) in the notes for the user's review (decision-62 rule for new names).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The UI docs ship in @lumiose/ui (packages/ui/docs), with their own generated and checked llms.txt and llms-full.txt
- [ ] #2 lumiose's llms.txt and the site link the UI llms.txt, and the site serves it
- [ ] #3 `lumiose docs` and the MCP find the UI pages and list the components with their parts, props, events and styling hooks
- [ ] #4 `lumiose agents init` adds the UI section and skill when the project depends on @lumiose/ui, and create-lumiose offers @lumiose/ui as an option
- [ ] #5 A test fails when an exported component has no docs page, no llms entry or an untyped example, or a part's prop has no JSDoc
- [ ] #6 The proposed public names are recorded for the user's review
<!-- AC:END -->
