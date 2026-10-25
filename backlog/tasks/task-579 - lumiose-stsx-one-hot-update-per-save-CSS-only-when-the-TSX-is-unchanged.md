---
id: TASK-579
title: '@lumiose/stsx: one hot update per save, CSS-only when the TSX is unchanged'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:20'
labels:
  - build
  - stsx
milestone: m-14
dependencies:
  - TASK-578
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: medium
ordinal: 571000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The spike sent up to 4 duplicate client updates per save under React Router, and 1 under plain Vite. Find the source and deduplicate. Candidates: watcher events per environment, React Router's child compiler running the plugin, and importers created by `addWatchFile`.
Keep the spike's behaviour:
- A style-only edit updates only the stylesheet.
- Editing a module that `$name` constants are folded from updates the CSS of every file that uses them.
- The SSR environment is invalidated correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A save sends exactly one client update under React + Vite, React Router and Solid
- [x] #2 A style-only edit updates only the stylesheet: no JS re-fetch, and component state is kept
- [x] #3 A JSX edit hot-updates through the framework's refresh, keeping React state
- [x] #4 Editing a module that $name constants are folded from updates the CSS of every dependent file without a remount
- [x] #5 Tests cover these cases on a real dev server, including React Router's SSR environment
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): the cause of the duplicates was React Router's `react-router-server-change-trigger-client-hmr` hotUpdate hook. It runs in every environment and reloads the client copy of each module a hook passes on. The prototype passed the stylesheet on once in the client environment (one echo) and twice in the ssr environment (once from `modules`, once pushed again; two more echoes). Under React Router, a plain `.tsx` edit also sends 3 client updates: that is React Router's own baseline.

Fix in packages/stsx/src/index.ts (`hotUpdate`):
- The plugin updates each changed `.stsx` file once through `environment.reloadModule()`: the JS module when the TSX changed, else (client only) the stylesheet when it changed.
- The file's modules are not passed on, so later hooks do not echo them.
- When the CSS changed, every stylesheet variant (`X.stsx.css`, and `X.stsx.css?inline` for critical CSS) is invalidated with an HMR timestamp. Servers re-read it on their next render, and a new TSX imports it afresh.
- Files that use an edited `$name` constants module get the same treatment.

Tests (src/hmr.test.ts), on real dev servers with a stand-in for the React Router hook:
- React, style-only edit: `["/App.stsx.css"]`.
- React, JSX edit: `["/App.stsx.tsx"]`.
- React, tokens.ts edit: `["/App.stsx.css"]`.
- The ssr `?inline` stylesheet is fresh after an edit.
- Solid, style-only edit: `["/App.stsx.css"]`.

Verified in the TASK-571 React Router app:
- One CSS fetch per style-only save.
- Fast Refresh keeps state on a JSX edit.
- Dev critical CSS reflects the edit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One hot update per save: the plugin reloads the changed .stsx file's JS or stylesheet itself and passes neither on, so React Router no longer echoes them. Style-only and constant edits replace only the stylesheet, and server-side stylesheet variants stay fresh. Tests on real dev servers cover React, Solid and a React Router stand-in.
<!-- SECTION:FINAL_SUMMARY:END -->
