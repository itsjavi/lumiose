---
id: TASK-80
title: >-
  IDE: project-wide globals, custom properties, scoped completion, Lumen
  attribute docs
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 20:34'
updated_date: '2026-10-08 20:57'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. LSP: read JSX element extents from the masked TSX (jsx.ts) and scope nested blocks to their enclosing element's subtree (decision-23) for class completion/definition/rename; rank innermost subtree, file, global, project.
2. Project style index (project-styles.ts): <style global> classes of all .stsx files plus classes of global .css files imported by project modules (with @import); custom properties declared in any block or imported .css, with values.
3. CSS completion: custom properties in var(--…) and at declaration names (local first, value as detail, declarations as docs).
4. <style …> open tag: only 'global' completion + hovers for <style>/global; move snippets from the VS Code contribution into the LSP with context checks (top-level statements; JSX children).
5. JSDoc for client:*, bind:*, ref, attach, key, on:x in jsx-runtime.ts; LSP fallback docs where TS cannot show JSDoc (on:x mapped members, key).
6. Protocol tests per item; VS Code smoke test update; rebuild .vsix; README reinstall instructions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-08 Beacon: claimed (.local/coordination/claims/TASK-80). Committed d9bad9e (JSX JSDoc) and 8d2a13c (LSP: jsx.ts, project-styles.ts, properties.ts, snippets.ts, descriptions.ts + protocol tests; 53/53 language-server tests). Note: the working-tree lumen_css (another agent's in-progress change) panics at crates/lumen_css/src/values.rs:226 ('byte range starts at 73 but ends at 72') on '.oops { color: ; }' (fixture Broken.stsx), killing the language server; LSP tests were validated with a clean HEAD binding (worktree build, loaded only into the server process).
<!-- SECTION:NOTES:END -->
