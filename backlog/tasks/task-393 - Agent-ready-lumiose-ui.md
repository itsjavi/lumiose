---
id: TASK-393
title: Agent-ready @lumiose/ui
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 18:05'
updated_date: '2026-10-15 18:39'
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
- [x] #1 The UI docs ship in @lumiose/ui (packages/ui/docs), with their own generated and checked llms.txt and llms-full.txt
- [x] #2 lumiose's llms.txt and the site link the UI llms.txt, and the site serves it
- [x] #3 `lumiose docs` and the MCP find the UI pages and list the components with their parts, props, events and styling hooks
- [x] #4 `lumiose agents init` adds the UI section and skill when the project depends on @lumiose/ui, and create-lumiose offers @lumiose/ui as an option
- [x] #5 A test fails when an exported component has no docs page, no llms entry or an untyped example, or a part's prop has no JSDoc
- [x] #6 The proposed public names are recorded for the user's review
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Beacon): claimed; worktree branch claude/beacon-m12-ec99fd.

2026-10-15 (Beacon): implemented on branch claude/beacon-m12-ec99fd, commits c5dfea39 (docs, CLI, MCP, agents, site, contract test, Dialog JSDoc), bc3c1352 (create-lumiose option) and e01e0322 (generator cleanup).

What landed:
- packages/lumiose/docs/ui/* moved to packages/ui/docs (in the package's `files`). Cross-package links go to the site URLs (https://itsjavi.com/lumiose/docs/...); the site rewrites them to its own pages and the contract test checks they exist.
- @lumiose/ui's llms.txt / llms-full.txt come from generateUiLlms in packages/cli/src/docs/generate.ts (shared with lumiose's). Overview (README and any guide), then Components (every page with `## Anatomy`, by title). `pnpm --filter @lumiose/ui docs:gen` / `docs:check` (packages/ui/scripts/gen-llms.ts). pnpm check covers freshness through packages/cli/src/docs/ui.test.ts, like lumiose's llms files.
- lumiose's docs index: the UI section links https://itsjavi.com/lumiose/ui/llms.txt and names node_modules/@lumiose/ui/docs/llms.txt; generateLlms now keeps absolute index links as they are.
- `lumiose docs` and the MCP docs tools/resources add the pages of an installed @lumiose/ui as `ui/` topics (the same topics as before the move). uiDocsDir walks node_modules up from the root instead of require.resolve, because pnpm's bin shims set NODE_PATH to the store.
- MCP tool `ui_components` (input `name?`): components with imports, parts {name, renders}, props {part, name, type, default, description}, events (callback props and `on:` events named in API), styling hooks (code spans of Styling that are classes, data attributes, selectors, custom properties), plus theme {layers, properties}. Parsed from the template, so the pages stay the single source.
- `lumiose agents init`: when package.json depends on @lumiose/ui, a UI part inside the Lumiose section of AGENTS.md and .claude/skills/lumiose-ui/SKILL.md (composition, bind: and events, styling with lu.core/lu.theme, state selectors and data-highlighted, --lu- variables, accessibility rules, verification). The part goes away when the dependency does; the skill file stays.
- create-lumiose: `--ui` and a y/N question add the dependency (^ the UI version), import @lumiose/ui/styles.css and themes/default.css in src/routes/layout.stsx (the minimal template's page.stsx) and write the UI agent files. Gate: create-lumiose has @lumiose/ui as a workspace devDependency and offers the option only when the resolved package is not private; while private, --ui exits 2 and the help omits it. Tests use main(argv, io, { offerUi: true }) and check + build a static app against the workspace package.
- Contract test (packages/cli/src/docs/ui.test.ts): every value export of packages/ui/src/index.ts has a page with the template's sections (a heading may continue after a comma), an llms.txt entry and a ```tsx check example in Example; it exports <Component>…Props types; each such type and every member of its own object types has JSDoc. examples.test.ts type-checks the UI pages' check blocks. Dialog.Root's props gained the missing JSDoc (the declaration and `children`).
- Docs: reference/cli.md (docs, agents init, mcp), reference/mcp.md (ui_components, ui/ topics, resources), getting-started.md (Status note on --ui), packages/ui/docs/README.md (the agent docs and the template).

Technical decisions (orchestrator-delegated):
- The UI llms.txt names no version ("match the installed version"): a release of @lumiose/ui then needs no regeneration, and scripts/release.ts stays untouched.
- Component pages are those with `## Anatomy`; anything else in packages/ui/docs is a guide listed under Overview (room for TASK-387's theming page).

Proposed public names, for the user's review:
- create-lumiose flag `--ui`; question "Add @lumiose/ui, accessible UI components with a default theme? (y/N)"; JSON report field `ui`.
- Skill `lumiose-ui` at .claude/skills/lumiose-ui/SKILL.md; AGENTS.md subsection "UI components (`@lumiose/ui`)" inside the lumiose markers.
- MCP tool `ui_components` (input `name`); docs topics `ui/…` (`lumiose docs ui`, `lumiose docs dialog`), resources `lumiose://docs/ui/<page>`.
- Paths: node_modules/@lumiose/ui/docs/{llms.txt,llms-full.txt}; site /ui/llms.txt and /ui/llms-full.txt (footer link "UI llms.txt"); the UI pages stay at /docs/ui/*.
- @lumiose/ui scripts `docs:gen`, `docs:check`; UI llms.txt title "Lumiose UI".

For integration:
- TASK-389 (making @lumiose/ui public) should also move @lumiose/ui from create-lumiose's devDependencies to its dependencies (else the published create-lumiose cannot resolve it and the option stays hidden), flip the gate test's first block, and drop the Status note in getting-started.md.
- packages/ui/README.md still says the docs are in packages/lumiose/docs/ui (Halo's file, not edited).
- New component pages (Popover, Tooltip, Tabs, Menu) must follow dialog.md: the eight sections, an Anatomy table with backticked part names, `### Component.Part` prop tables (Prop, Type, Default, description), a ```tsx check block in Example, hooks as code spans in Styling, JSDoc on every exported *Props type and member; then `pnpm --filter @lumiose/ui docs:gen`.

Validation (2026-10-15): pnpm check green (typecheck, lint, fmt:examples, Vitest 2069 passed / 2 skipped, script tests, size caps, cargo test); apps/web Playwright 66 passed, 3 skipped (/ui/llms.txt and /ui/llms-full.txt checked); create-lumiose's --ui test checks and builds a static app against the workspace @lumiose/ui. No Rust changes. Halo's and Spark's new pages were not on main yet: the contract test checks them when they land.
<!-- SECTION:NOTES:END -->
