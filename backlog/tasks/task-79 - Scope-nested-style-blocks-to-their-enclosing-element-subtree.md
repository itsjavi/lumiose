---
id: TASK-79
title: Scope nested style blocks to their enclosing element subtree
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 20:34'
labels: []
milestone: m-1
dependencies:
  - TASK-77
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user decided (decision-23, amending decision-14) that a <style> inside a component styles only its enclosing element's subtree. A <style> directly under the component's root element therefore still covers the whole component. Today every <style> inside a component applies to the whole component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each <style> inside a component gets its own scope token, stamped on its enclosing element and every element lexically inside it in that component's JSX (lexical rule: JSX authored inside the subtree, including children passed to components there); file-level and global blocks unchanged; both client and server templates
- [ ] #2 Class passthrough ($$scope) at a call site passes the caller's applicable tokens (enclosing-subtree chain + file); lumen_css receives each block with its token (coordinate with Halo if lumen_css's Scope needs a new variant)
- [ ] #3 Golden fixtures for nested subtrees, siblings (C1 not styled by a sibling subtree's style), passthrough, async components and .map rows; docs updated (Beacon follow-up note)
<!-- AC:END -->
