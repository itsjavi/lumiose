---
id: TASK-80
title: >-
  IDE: project-wide globals, custom properties, scoped completion, Lumen
  attribute docs
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 20:34'
labels: []
milestone: m-4
dependencies: []
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user tried authoring .stsx in VS Code and reported issues (2026-10-08): <style global> classes from other files are not offered; class completion offers classes from any style in the component regardless of tree position (decision-23 now scopes nested styles to their enclosing subtree); custom properties (--x) from the project's styles are only partially offered; attribute completion inside <style …> shows the snippets (acomp, comp, island, route) instead of 'global'; Lumen attributes (client:*, bind:*, on:*, attach, <style global>) have no descriptions. The installed .vsix also predates TASK-48/66.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Class completion and go-to-definition include every class from <style global> blocks across the workspace's .stsx files and from imported global .css files, plus file-level classes, plus enclosing-subtree classes per decision-23 (not sibling subtrees); ranked local first
- [ ] #2 var(--…) and custom property completion lists all custom properties declared anywhere in the project's styles (global, file, component, .css), with their declared values as detail; local first
- [ ] #3 Inside <style …> the only attribute completion is 'global' with a description; snippets are offered only in TS statement/JSX contexts (move them to LSP-provided completions with context checks, or otherwise scope them)
- [ ] #4 Descriptions (hover and completion docs) for client:load|idle|visible|media|only, bind:value|checked, on:x, attach, ref, key and <style global>, via JSDoc in the JSX types plus LSP hovers; a rebuilt .vsix with reinstall instructions in packages/vscode/README.md; protocol tests
<!-- AC:END -->
