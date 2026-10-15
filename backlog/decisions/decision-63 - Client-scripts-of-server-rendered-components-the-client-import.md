---
id: decision-63
title: 'Client scripts of server-rendered components: the ?client import'
date: '2026-10-15 17:32'
status: accepted
---
## Context

A server-rendered component sometimes needs a small browser script without becoming an island: a custom element definition for @lumiose/ui's Menu or Combobox (decision-62), Dialog's enhancement script, or a theme toggle (TASK-283). Before TASK-354 the only ways to run code in the browser were islands (which load the runtime) and `instrumentation.client.ts` (every page). Nova implemented the mechanism behind an internal `?lumiose-client` query and proposed spellings for the user.

## Decision

User decision, 2026-10-15.

- A component imports the script with the `?client` query and calls the import while it renders: `import defineMenu from "./menu.element.ts?client"; … defineMenu();`.
- The page that renders it gets one `<script type="module" async>` for the script (plus modulepreloads for its imports), in the head or in the chunk of the streamed boundary that rendered it, without the island runtime. The script never runs on the server.
- In islands and SPA pages the import loads the same module and the call does nothing, so the script runs once.
- The project scan finds these imports, and the client build builds each as an entry; an import the scan did not see is a warning. Script modules must not import `lumiose`.
- Rejected: `?script`, `?browser`, a component form (`<MenuScript />`), an import attribute.

## Consequences

- TASK-354 renames the internal query, adds the module type to the JSX and env types and documents it; TASK-283's need (small scripts without the runtime) is covered.
- Packages installed from node_modules are not scanned yet (TASK-390).
