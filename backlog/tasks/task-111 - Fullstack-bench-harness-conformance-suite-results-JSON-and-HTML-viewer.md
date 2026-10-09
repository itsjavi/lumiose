---
id: TASK-111
title: 'Fullstack bench: harness, conformance suite, results JSON and HTML viewer'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 04:20'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-4 §4–§7: @bench/harness runner for every metric, the shared Playwright conformance suite (e2e/), the results JSON format and results/index.json, and the static viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm --filter @bench/harness bench [--quick|--only|--metrics] measures every metric in doc-4 §4 and writes results/<date>-<host>.json + index.json
- [ ] #2 The conformance suite covers doc-4 §5 and runs against any app by base URL
- [ ] #3 viewer/index.html shows a run (and a comparison of two runs) per metric group with tables and bar charts; served by the view script
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova 2026-10-09: conformance suite committed at benchmarks/fullstack/harness/e2e/ (moved under the harness package, not benchmarks/fullstack/e2e: Node resolves @playwright/test from the test file's directory and e2e/ is not a workspace package; keeping it inside @bench/harness avoids a root workspace-glob change).
MARKUP CONTRACT for Quasar (all apps): the data-testid landmarks and form field names are listed at the top of harness/e2e/landmarks.ts. Key points: every page's h1 is page-title; issue-row has data-id; issue-status/issue-priority carry data-status/data-priority with the raw values (open|in_progress|closed, low|medium|high|urgent); stat-value and counts are plain integers; page-prev absent on page 1, page-next absent on the last page; label-option buttons carry data-label=<value> and aria-pressed; hidden input labels = selected values joined by ','; field-error-<field> holds validation messages; /api/search returns the JSON array of searchIssues(q, 8); /api/issues/:id 404 for unknown ids; the footer (site-footer) contains the text 'Tracker benchmark' (the harness HMR probe edits that text in the shared Layout file: harness/src/apps.ts assumes packages/react-ui/src/Layout.tsx for both React apps; tell me if it lives elsewhere); every page sets window.__benchReady = performance.now() once its interactive parts are hydrated (pages with none: when parsed). Mutating actions without a session redirect to /login. Login: POST /login with username; unknown user re-renders with field-error-username. Logout: logout-form posts to /logout.
Run: pnpm --filter @bench/harness conformance [--only react-router] [--no-build], or --url http://127.0.0.1:4102 against a running server. The runner seeds, builds, starts with COMMENTS_DELAY_MS=150 and checks that comments stream after the shell.

Nova 2026-10-09 (supersedes my earlier contract note): the conformance suite now follows the @bench/react-ui markup as written by Quasar (its data-testids, classes and button testids), so the React apps need no changes for it; harness/e2e/landmarks.ts documents the contract. What the apps must still provide: recent-issues as the testId of the dashboard's IssueList; filter form/new-issue/login/status/comment/search forms are found by their inner testids (filter-submit, create-issue, login-submit, status-select, comment-input, search-input); POST /logout from the logout-button's form; /api/search returns the plain array of searchIssues(q, 8); /api/issues/:id 404 for unknown/invalid ids; /issues/abc and /projects/unknown are 404 pages with not-found inside the layout; login as 'alice'; comments-loading must be in the streamed shell when COMMENTS_DELAY_MS>0; window.__benchReady (BenchReady). HMR probe: the harness edits 'fullstack comparison benchmark' in packages/react-ui/src/layout.tsx (React apps) and restores it.
<!-- SECTION:NOTES:END -->
