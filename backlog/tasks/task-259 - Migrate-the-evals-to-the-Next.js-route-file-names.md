---
id: TASK-259
title: Migrate the evals to the Next.js route file names
status: To Do
assignee:
  - Quasar
created_date: '2026-10-12 20:09'
updated_date: '2026-10-12 21:45'
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
- [ ] #1 Every evals/tasks/*/start and */solution project uses page/route/layout/not-found/error files (lumiose routes lists the same URLs as before)
- [ ] #2 Task prompts, graders and evals/src mention the new file names
- [ ] #3 lumiose check passes on each solution project; no eval run without the user's permission
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: edit eval task files only; never run evals, pnpm validate or eval scripts (user permission required).
<!-- SECTION:NOTES:END -->
