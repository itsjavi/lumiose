---
id: TASK-191.2
title: 'Rename sweep: examples, apps, tooling, benchmarks and evals'
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 18:17'
updated_date: '2026-10-10 18:50'
labels:
  - api
  - dx
dependencies: []
parent_task_id: TASK-191
priority: high
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-35. After the runtime renames land (TASK-191.1), update every consumer outside packages/lumiose/src and packages/vite: examples/**, apps/**, packages/{cli,create,site-kit,testing,language-server,vscode,eslint-plugin,prettier-plugin}, benchmarks/** (Lumiose apps only), evals/tasks. Same rename list as TASK-191.1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No consumer uses an old name (grep proof); pnpm check green; examples build and their e2e suites that touch renamed APIs pass
- [x] #2 llms.txt/llms-full.txt regenerated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: swept evals hidden tests (flushSync->flush, mount->render; renamed cart.test helper to renderCart to avoid shadowing), spa-router-e2e, spa-dotmatrix, ssr-bookshelf, vite-counter, benchmarks (fullstack lumiose islands, js-framework-benchmark incl. hand-compiled.js), playground preview, site-kit showcase, cli check test; docs: reference/app.md heading isSubmitting, LUM4008 provide/inject text, cli docs/index.ts comment. Commits 9a22ab1..4c866d6. Checks: typecheck, lint (warnings only), test, builds, spa-router-e2e/vite-counter/ssr-bookshelf e2e, evals validate for 8 tasks, docs:gen/check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consumers renamed to decision-35 names; no old Lumiose API names remain outside lumiose/src, vite, crates; builds, e2e, evals validate and docs checks green.
<!-- SECTION:FINAL_SUMMARY:END -->
