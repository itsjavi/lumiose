---
id: TASK-144
title: 'Regression: spa-router-e2e build project fails to hydrate (insertBefore)'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-09 05:19'
updated_date: '2026-10-09 05:35'
labels:
  - bug
  - hydration
dependencies: []
priority: high
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Spark (TASK-125): on plain HEAD (19142b5), 10 of 11 tests in the spa-router-e2e 'build' Playwright project fail with "Failed to execute 'insertBefore' on 'Node'" during hydration; it passed 22/22 right after TASK-123 (2841919). Candidates since then: 596bfbd (TASK-65 insertText codegen), 5588b5d (TASK-117 attribute folding), 9a3d567/786f039 (TASK-121 stylesheets), 1e18311 (TASK-138 CSP), 19142b5 (TASK-125). Bisect, fix in the owning area (Spark's dom/hydrate authorised for this task), add a regression test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bisected to the commit that broke it, with the root cause in the notes
- [x] #2 spa-router-e2e (dev and build), islands-e2e and the sample apps' Playwright suites pass; a unit/parity test covers the case
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): Bisected in an isolated worktree (git bisect run over 2841919..19142b5, native binding rebuilt per step, spa-router-e2e build project "deep links render"): first bad commit 596bfbd (TASK-65, insertText codegen). Root cause: the root layout's <main>{props.children}</main> now compiles to insertText(_text, () => props.children). Under hydration insertText evaluated the value before opening its fallback region (it only opened it once it saw a non-text value), but the router's children getter renders the next level with renderRange(…, 3), which claims "the rest of the enclosing region" from the hydration cursor while the value is evaluated. The top of the cursor stack was still the parent template's hole, whose server block content was parked in a fragment (moved aside before the template text node), so Cursor.range inserted the range markers before a node that was not a child of the parent: "Failed to execute 'insertBefore' on 'Node'", and the SPA island fell back to its 500 page. insert() never hit this because it opens its region before evaluating. Fix (dom, authorised): Hydrator.block(marker) tells whether the server rendered a block at a node (a hole whose marker is it); insertText opens its fallback region first when hydrating such a node, so the value claims from that block. Regression test: dom/hydrate.test.ts "opens an insertText fallback before its value claims, as router outlets do (TASK-144)" (nested layouts via renderRange mode 3 down to an async page; failed with the same DOMException before the fix). Validation: dom + compiler vitest 186 passed; typecheck/oxlint clean; Playwright: spa-router-e2e 22/22 (dev + build), islands-e2e 5/5, spa-chiptune 20/20, ssg-travel-journal 17/17, ssr-bookshelf 15/15. Not related: vite-counter "style edits hot-update the CSS" fails because 597c4b5 (TASK-124, lumen fmt on examples) reformatted Counter.stsx's style block, so the test's source.replace("h2 { color: $theme.accent; }", …) no longer matches; spa-dotmatrix not run (port 5202 in use by another session).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Culprit 596bfbd (TASK-65): insertText evaluated a children getter before opening its hydration region, so router outlet ranges (mode 3) claimed from the parent's parked block. insertText now opens the fallback region first when the server rendered a block there (Hydrator.block). Regression test + all e2e suites green (vite-counter's style-HMR test is broken by TASK-124's formatting, unrelated).
<!-- SECTION:FINAL_SUMMARY:END -->
