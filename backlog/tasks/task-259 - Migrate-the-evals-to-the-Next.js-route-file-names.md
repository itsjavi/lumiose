---
id: TASK-259
title: Migrate the evals to the Next.js route file names
status: Done
assignee:
  - Quasar
created_date: '2026-10-12 20:09'
updated_date: '2026-10-12 21:51'
labels:
  - evals
  - router
milestone: m-9
dependencies:
  - TASK-253
priority: medium
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-253 (decision-42) moved every app in the repo to page.stsx / route.ts / layout / not-found / error and made any other file in src/routes a colocated module, but evals/ was outside its brief (Quasar's area). evals/tasks/*/start and */solution still use index.stsx, flat page files (about.stsx, search.stsx), .ts endpoints (api/books.ts) and _layout/_404, so start projects no longer route and the reference solutions would fail their graders. Task prompts and graders that name route files need the new names too (for example custom-404 asks for _404.stsx). Edit only: do not run evals without the user's permission.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every evals/tasks/*/start and */solution project uses page/route/layout/not-found/error files (lumiose routes lists the same URLs as before)
- [x] #2 Task prompts, graders and evals/src mention the new file names
- [x] #3 lumiose check passes on each solution project; no eval run without the user's permission
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: edit eval task files only; never run evals, pnpm validate or eval scripts (user permission required).

Quasar 2026-10-12: migrated every evals/tasks/*/start and */solution project to decision-42 names (git mv, history kept): index -> page.stsx (start + solution), flat pages -> <dir>/page.stsx (about, contact/thanks, search, todos, tags/[tag], blog/[slug], products/[sku]), endpoints -> <dir>/route.ts (api/books, api/messages, api/stock/[sku]), _layout/_404 -> layout/not-found (about-page, custom-404). Relative imports deepened for files that moved one folder down. Prompts updated: styled-badge and fix-island-function-prop (src/routes/page.stsx), like-button-island (src/routes/blog/[slug]/page.stsx). Hidden test counter-island/counter.test.ts reads src/routes/page.stsx. custom-404 prompt is behavioural (names no file), evals/src, grader/helpers.ts and doc-5 name no route files, so unchanged. No solution.remove.json needed: start files already use the new names, so the solution overlays the same paths.
Verification without the eval harness (no eval run, no pnpm validate, nothing under evals/ executed): .local/agents/quasar/quasar-20261012T214708Z-t259/verify.ts builds each task's start and start+solution project like evals/src/workspace.ts (scaffold() from packages/create at the working tree, start/ overlay, task.remove, solution/ overlay), in the session tmp scratchpad (outside the pnpm workspace), links the working tree's lumiose/@lumiose/vite/@lumiose/cli/vite/typescript, then runs node packages/cli/src/bin.ts routes and check --format json. Result: 40/40 projects route ok, and lumiose routes lists exactly the URL patterns the old file names gave (old templates at 64f5d99^ + old eval files at HEAD, mapped with the old index/flat/_special rules); lumiose check on all 20 solution projects: 0 errors, 0 warnings (it caught one wrong import depth in contact/page.stsx, fixed). Sanity: check reports a typed href() error in a route, so routes are type-checked. Not verified: the hidden tests themselves (needs pnpm validate = eval harness).
Proposal for the user: run pnpm --filter @lumiose/evals validate (all tasks; hidden tests must fail on start and pass on solution) to confirm the graders end to end. It needs your permission (eval scripts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evals use the decision-42 route names: start projects, reference solutions, prompts and the one hidden test that names a route file. lumiose routes lists the same URLs as before for all 40 start/solution projects and lumiose check passes on all 20 solutions (scripted with packages/cli, no eval harness). Proposal: run pnpm --filter @lumiose/evals validate with the user's permission to confirm the hidden tests.
<!-- SECTION:FINAL_SUMMARY:END -->
