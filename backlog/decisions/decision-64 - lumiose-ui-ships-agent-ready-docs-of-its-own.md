---
id: decision-64
title: '@lumiose/ui ships agent-ready docs of its own'
date: '2026-10-15 18:05'
status: accepted
---
## Context

The user asked on 2026-10-15 for @lumiose/ui to be agent-ready like lumiose. Concretely:
- docs for agents, which create-lumiose can install optionally;
- a separate llms.txt for the UI, linked from the main one;
- whatever helps agents discover the components and learn how to use and style them.

Lumiose is already agent-ready (spec §10, decision-10):
- versioned Markdown docs ship in the package, with `llms.txt` and `llms-full.txt`;
- `lumiose docs` and `lumiose explain`;
- an MCP server;
- `lumiose agents init`, which writes the AGENTS.md section and the `lumiose` skill.

The UI pages lived in packages/lumiose/docs/ui. @lumiose/ui keeps its own 0.x versions (decision-54), so those pages could describe a different version than the one a project installs.

## Decision

Orchestrator decision (Lux, 2026-10-15), from the user's request. The public names were approved by the user on 2026-10-15 (TASK-393):
- the create-lumiose flag `--ui`;
- the `lumiose-ui` skill and its AGENTS.md subsection;
- the MCP tool `ui_components`, the `ui/…` docs topics and the `lumiose://docs/ui/<page>` resources;
- the site paths `/ui/llms.txt` and `/ui/llms-full.txt`;
- @lumiose/ui's `docs:gen` and `docs:check` scripts.

- **The UI docs ship in @lumiose/ui**, in packages/ui/docs. That puts them in `node_modules/@lumiose/ui/docs` and keeps them on the installed version. They have their own generated and checked `llms.txt` and `llms-full.txt`. lumiose's `llms.txt` links the UI one, with both the installed path and the site URL, and the site serves it.
- **Every component page follows one template**, the sections of the Dialog page: Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related. Agents find the same facts in the same place. A test checks that every exported component has a page, an llms entry and a type-checked example. It also checks that every prop of every part has a JSDoc comment, which editors and agents read from the types.
- **The existing agent tools learn about the UI**, instead of new ones being added:
  - `lumiose docs` and the MCP find the UI pages when @lumiose/ui is installed;
  - the MCP lists the components with their parts, props, events and styling hooks;
  - `lumiose agents init` adds a UI section and a UI skill when the project depends on @lumiose/ui;
  - create-lumiose offers @lumiose/ui as an option, which installs the package, its styles and these agent files.
- The site's UI section (TASK-387) renders the same pages, so the agent docs and the site come from one source. It lives at `/ui` and `/ui/<page>`, and `/docs/ui/*` redirects there. The header links to it as "UI" and the footer as "UI components" (user, 2026-10-16, TASK-400).

## Consequences

- TASK-393 (Beacon) builds it. Every open component task gains the acceptance criterion that its page follows the template and is in the UI llms.txt.
- The create-lumiose option ships once @lumiose/ui is public (TASK-389).
- AGENTS.md's docs rule extends to packages/ui/docs for UI changes.
