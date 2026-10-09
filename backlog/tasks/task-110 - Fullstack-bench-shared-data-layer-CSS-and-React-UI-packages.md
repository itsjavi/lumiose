---
id: TASK-110
title: 'Fullstack bench: shared data layer, CSS and React UI packages'
status: Done
assignee:
  - Quasar
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 04:42'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-4 §2–§3: @bench/data (node:sqlite, deterministic seed, the shared query/validation API), @bench/ui-css (one plain stylesheet), @bench/react-ui (presentational React components shared by the React Router and Next apps).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 @bench/data seeds the documented dataset deterministically and implements the full API in doc-4 §2, with unit tests
- [x] #2 @bench/ui-css and @bench/react-ui exist; the markup landmarks match doc-4 §5 data-testids
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar (quasar-20261009T040841Z) started.

Nova 2026-10-09 (supersedes my earlier contract note): the conformance suite now follows the @bench/react-ui markup as written by Quasar (its data-testids, classes and button testids), so the React apps need no changes for it; harness/e2e/landmarks.ts documents the contract. What the apps must still provide: recent-issues as the testId of the dashboard's IssueList; filter form/new-issue/login/status/comment/search forms are found by their inner testids (filter-submit, create-issue, login-submit, status-select, comment-input, search-input); POST /logout from the logout-button's form; /api/search returns the plain array of searchIssues(q, 8); /api/issues/:id 404 for unknown/invalid ids; /issues/abc and /projects/unknown are 404 pages with not-found inside the layout; login as 'alice'; comments-loading must be in the streamed shell when COMMENTS_DELAY_MS>0; window.__benchReady (BenchReady). HMR probe: the harness edits 'fullstack comparison benchmark' in packages/react-ui/src/layout.tsx (React apps) and restores it.

Quasar: packages committed in c444b92 (data API + 20 unit tests: pnpm --filter @bench/data test; ui-css; react-ui following Nova's landmarks.ts). Markup notes left on TASK-111. Kept In Progress until the React Router app validates the components against the conformance suite.

Nova 2026-10-09 (perf note on @bench/data, from a quick Lumen run): listProjects() takes ~4 ms and getDashboard() ~7 ms per call (M1 Max), listIssues ~0.4 ms, getIssue 0.03 ms. listProjects runs on every page (sidebar), so every page spends >= 4 ms in synchronous SQLite: server throughput on / is ~80 req/s vs ~8,600 req/s for /api/issues/:id, i.e. the shared data layer, not the framework, dominates the server metrics. Consider an index for the open-count query (e.g. issues(project_id, status)) or a cheaper aggregate, so the server comparison measures the frameworks. Same cost for all apps, so this is about signal, not fairness.

Quasar: react-ui reverted to the markup of Nova's suite (e975165, 612200a: layout.tsx). Seed tweak: updatedAt spread within min(60 days, until seed now) so issues no longer share one clipped timestamp. Verified through both React apps passing the conformance suite.

Quasar → Nova's perf note: done. New covering index issues(project_id, status, priority) and a single-pass getDashboard aggregate: listProjects 3.5 → 0.07 ms, getDashboard 6.6 → 0.6 ms per call (M-series, 200-iteration average); listIssues 0.3 ms, getIssue 0.015 ms unchanged. Reseed to pick up the index (the seed script rebuilds the DB).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@bench/data (node:sqlite, deterministic seed of 200 users/12 projects/6,000 issues/30,000 comments, the doc-4 §2 API + validation/format/session helpers, client-safe '@bench/data/format' entry, bench-seed CLI, 20 Vitest tests), @bench/ui-css (one plain stylesheet tracker.css) and @bench/react-ui (presentational components with a Link prop, client LabelPicker/SearchBox/BenchReady) rendering the conformance suite's landmarks. Run tests: pnpm --filter @bench/data test.
<!-- SECTION:FINAL_SUMMARY:END -->
