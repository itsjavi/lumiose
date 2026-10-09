---
id: TASK-41
title: Build the ESLint and Prettier plugins
status: To Do
assignee:
  - Beacon
created_date: '2026-10-08 12:21'
updated_date: '2026-10-09 12:12'
labels: []
milestone: m-7
dependencies:
  - TASK-31
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: low
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teams on ESLint or Prettier need .stsx support without the lumen wrappers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 eslint-plugin-lumen with rules and a .stsx processor; prettier-plugin-lumen formatting .stsx; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09 (user-approved): priority oxlint → oxfmt → ESLint → Prettier. Single source of truth: the compiler's LUM diagnostics; plugins are thin adapters. First verify current oxlint JS plugin support (one ESLint-compatible package may serve oxlint and ESLint) and whether oxfmt has any plugin/embedded-language API; .stsx stays on lumen lint/fmt where the tools cannot parse <style> blocks.
<!-- SECTION:NOTES:END -->
