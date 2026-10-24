---
id: TASK-563
title: 'Router docs: unsaved changes recipe for beforeNavigate'
status: Done
assignee:
  - Beacon
created_date: '2026-10-24 15:39'
updated_date: '2026-10-24 15:51'
labels:
  - docs
  - router
dependencies: []
priority: medium
ordinal: 555000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lux's request (2026-10-24): add a short Unsaved changes recipe where the router docs cover beforeNavigate, for 0.7.0's semantics (decision-50 amendment, TASK-549): cancel every navigation while the page has unsaved work, show your own dialog for link/navigate with navigation.to.url, let the browser prompt for leave; a Leave button that sets a flag and navigates (location.assign on MPA pages, navigate() in an SPA). Docs only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 reference/router.md has an Unsaved changes recipe with a type-checked example for MPA islands and SPAs, linked from concepts/routing.md
- [x] #2 docs:gen output is current; docs:check, the docs tests and typecheck pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-24, worktree run for Lux). reference/router.md: a new Unsaved changes subsection under Navigation hooks (0.7.0 semantics, decision-50 amendment / TASK-549). The hook cancels every navigation while the page has unsaved work; link and navigate open the page's own dialog with navigation.to.url (to === null, a URL outside the app, falls back to confirm()); leave lets the browser prompt; popstate returns to the page. The Leave button sets a flag and calls location.assign (MPA islands load no router) or navigate() in an SPA. A POST form that saves clears the dirty state in onSubmit, since saving unloads as leave. One sentence links Lists and keys (TASK-558) for editable rows. The example is a tsx check block (type-checked by packages/cli/src/docs/examples.test.ts; a deliberate type error in it failed the test, so the check is live). The intro to the cancel semantics now links the recipe; concepts/routing.md's hooks bullet links it too. llms-full.txt regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an Unsaved changes recipe to reference/router.md (linked from concepts/routing.md): cancel every navigation while dirty, own dialog for link/navigate with navigation.to.url, browser prompt for leave, a Leave button that sets a flag and follows the URL (location.assign on MPA pages, navigate() in an SPA). Type-checked example. Validation: docs:gen/docs:check, packages/cli/src/docs and apps/web content tests (57 passed), pnpm typecheck green.
<!-- SECTION:FINAL_SUMMARY:END -->
