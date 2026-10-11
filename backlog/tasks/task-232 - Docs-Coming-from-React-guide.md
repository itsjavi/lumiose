---
id: TASK-232
title: 'Docs: Coming from React guide'
status: Done
assignee:
  - Lux
created_date: '2026-10-11 02:34'
updated_date: '2026-10-11 02:36'
labels:
  - docs
dependencies: []
priority: medium
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a top-level docs guide that maps React habits to Lumiose: the setup-once mental model, a hooks-to-primitives table, what goes away (rules of hooks, dependency arrays, stale closures, memoization) and the traps that replace them, linking to the concept pages and LUM diagnostics instead of repeating them. Primary audience: coding agents that default to React patterns (llms.txt), and React developers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/lumiose/docs/coming-from-react.md exists and is linked from the docs README under Start here
- [x] #2 Covers the mental model, a React-to-Lumiose mapping table, what goes away, and the new traps with their LUM codes, including the async-component re-run exception
- [x] #3 Code examples marked check type-check in the docs examples test
- [x] #4 llms.txt and llms-full.txt regenerated; docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Write coming-from-react.md (guide page, like upgrading.md). 2. Link it from README Start here. 3. docs:gen, docs:check, cli docs tests. 4. Commit docs + task file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Standalone session: Lux writes the page; Beacon owns docs structure (new top-level page follows the upgrading.md precedent).

Verified: docs:gen (llms.txt, llms-full.txt), docs:check, packages/cli/src/docs tests (17 pass). Negative check: an injected type error in the Lumiose example failed examples.test.ts, so the example is type-checked. No apps/web change needed: the site globs docs/**/*.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added packages/lumiose/docs/coming-from-react.md, linked under Start here in the docs README: the setup-once mental model (with the async-component re-run exception), a React-to-Lumiose mapping table, what goes away (rules of hooks, dependency arrays, stale closures, memoization, context re-renders), a table of the mistakes React habits cause with their LUM codes, and a side-by-side React/Lumiose clock example (the Lumiose one type-checked). llms.txt and llms-full.txt regenerated.
<!-- SECTION:FINAL_SUMMARY:END -->
