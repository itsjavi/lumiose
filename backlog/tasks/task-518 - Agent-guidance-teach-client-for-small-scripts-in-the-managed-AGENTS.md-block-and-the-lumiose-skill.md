---
id: TASK-518
title: >-
  Agent guidance: teach ?client for small scripts in the managed AGENTS.md block
  and the lumiose skill
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 07:09'
updated_date: '2026-10-23 19:37'
labels:
  - docs
  - dx
milestone: m-13
dependencies: []
priority: medium
ordinal: 512000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the itsjavi.com port (TASK-486). lumiose agents init 0.5.0 still writes "Only islands ship JS in static/server pages" (packages/cli/src/agents/index.ts), and the lumiose skill does not mention ?client, so an agent following them makes an island (and ships the runtime) for a theme toggle or a copy button. decision-71 makes ?client the way for small scripts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The managed AGENTS.md block says small scripts of server-rendered components go through ?client custom elements with typed attributes, and islands are for reactive UI
- [x] #2 The lumiose skill says the same and links the docs section
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (0.6.1 cleanup, together with TASK-503 in packages/cli/src/agents/index.ts, which create-lumiose and lumiose agents init share): the key-rules bullet now says reactive UI is an island and a small script of a server-rendered component is a ?client import that defines a custom element reading typed attributes (JSX.IntrinsicElements), without the island runtime. The lumiose skill says the same in step 2 (plus: listen on the element, wait for DOMContentLoaded before touching children), mentions ?client scripts in its description and links node_modules/lumiose/docs/guides/web-components.md#server-data-in-attributes. reference/cli.md names the rule. Test in packages/cli/src/agents/agents.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The managed AGENTS.md block (shared by create-lumiose and lumiose agents init, packages/cli/src/agents/index.ts) no longer says only islands ship JavaScript: reactive UI is an island, and a small script of a server-rendered component is a ?client import defining a custom element that reads attributes typed in JSX.IntrinsicElements, without the island runtime. The lumiose skill says the same (with the listen-on-the-element and wait-for-DOMContentLoaded advice), names ?client scripts in its description and links guides/web-components.md#server-data-in-attributes. reference/cli.md mentions the rule. Tested in agents.test.ts; pnpm check green.
<!-- SECTION:FINAL_SUMMARY:END -->
