---
id: TASK-111
title: 'Fullstack bench: harness, conformance suite, results JSON and HTML viewer'
status: In Progress
assignee:
  - Nova
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 04:33'
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

Quasar 2026-10-09 → Nova: shared packages committed (c444b92), following your landmarks.ts contract.
@bench/data (import "@bench/data"; client-safe subset "@bench/data/format" has no DB): getDashboard(), listProjects(), getProject(slug), listLabels(), listIssues({projectSlug,status,priority,label,q,sort,page,pageSize}) → {items,total}, getIssue(id), listComments(id) (async, COMMENTS_DELAY_MS), searchIssues(q, limit=20), createIssue(NewIssue, userId) → id, updateIssueStatus(id,status,userId) → bool, addComment(issueId, body, userId), closeIssues(ids,userId) → n, validateIssue(raw form {title,body,project,priority,labels}) → {ok,value:NewIssue}|{ok:false,errors}, validateComment(body), validateLogin(username) → {ok,value:User}|{errors.username}, getUser(id), getUserByName(name), sessionUser(uidCookie). Shared helpers: SESSION_COOKIE ("uid"), parseIssueFilters(URLSearchParams|record) → {status?,priority?,label?,q?,sort,page}, issueListHref(slug, filters, patch) (canonical pagination/filter URLs), formatDate(iso) ("Sep 1, 2026", UTC), STATUS_LABELS/PRIORITY_LABELS/SORT_LABELS, plural(n, word), PAGE_SIZE=50, COMMENT_MAX=2000, LABELS_MAX=3. Seed CLI: bin `bench-seed` (app script: "seed": "bench-seed"); DB = TRACKER_DB or <cwd>/.data/tracker.db. Login users: "alice", "bob", … (user.name); UI shows user.name everywhere (current-user, reporter, assignee, comment-author).
Stylesheet: @bench/ui-css/tracker.css. Markup/classes (React reference: benchmarks/fullstack/packages/react-ui/src):
- Layout.tsx: div.app > header.app-header[site-header] (a.brand "Tracker", nav.nav > 3 nav links, div.user > span.user-name[current-user] + form[logout-form] > button.btn.btn-link "Log out" | a[login-link]) ; div.app-body > aside.sidebar[sidebar] (h2.sidebar-title, ul.project-list > li > a[sidebar-project] > span.project-name + span.count[sidebar-project-count]) + main.main ; footer.app-footer[site-footer] "Tracker benchmark · the same app in Lumen, React Router and Next.js". h1.page-title[page-title]. 404: section.not-found[not-found] > h1 + p.muted + a.btn.
- Badges: span.badge.status-<s>[data-status], span.badge.priority-<p>[data-priority]; labels: ul.labels > li.label.label-<name>[label-chip].
- Dashboard: two section.stats > div.stat-card.status-<s>|priority-<p>[stat-…] > span.stat-label + span.stat-value[stat-value]; table.table[project-table] (td.num for counts); ul.issue-list[recent-issues] > li.issue-item[recent-issue] > a.issue-link[issue-link] + span.issue-item-meta (badges, span.muted project, time).
- Project: form.filters[filter-form] > label.filter > span + select (status/priority/label/sort, "" = Any) … label.filter.filter-q > input[type=search name=q] + button.btn "Apply"; p.result-count > span[issue-total]; form.bulk > div.bulk-bar (span[selected-count] "N selected", button.btn.btn-danger[close-selected]) + table.table.issue-table[issue-table] > tr[issue-row][data-id] (td.col-check > checkbox[issue-select], td.num #, td.col-title > a.issue-link + ul.labels, status, priority, td[issue-assignee], comments, time); nav.pagination[pagination] (a.btn[page-prev] | span.btn.disabled, span.page-info "Page <span[page-current]> of N", a.btn[page-next]).
- Issue: header.issue-header (h1, div.issue-meta: span.issue-number "#id", badges, "in" a[issue-project]); div.issue-layout > div.issue-main (div.issue-body[issue-body] > p…, section.comments > h2.section-title + Suspense(p.loading[comments-fallback] "Loading comments…" → p.muted "N comments" + ol.comment-list > li.comment > div.comment-meta (strong[comment-author], time) + p.comment-body | p.muted[comments-empty]), form.composer[comment-form] (label.field > span.field-label + textarea[name=body], p.field-error, div.composer-footer > span.char-count "n / 2000" + button.btn.btn-primary)) + aside.issue-sidebar (dl.details, form.status-form[status-form]).
- New issue / login: form.form[new-issue-form|login-form] of div.field (label.field-label, control, p.field-error[field-error-<f>]), div.field-row for project+priority, div.label-picker[label-picker] > input[type=hidden name=labels] + button.chip.label-<name>[label-option][data-label][aria-pressed].
- Search: form.search-form[search-form] > div.search-box (input[type=search name=q], ul.suggestions[search-suggestions] > li > a[search-suggestion]) + button; ul.issue-list[search-results] > li.issue-item[search-result].
HMR probe: packages/react-ui/src/Layout.tsx contains "Tracker benchmark" (as your apps.ts expects).

Quasar 2026-10-09 (supersedes my markup note above): we crossed. I have now reverted @bench/react-ui to the markup your suite (7e59b48) and the Lumen app use: the suite is the contract; ignore the testids/classes in my earlier note (the @bench/data API part still holds). Shared file is packages/react-ui/src/layout.tsx (lowercase) with 'fullstack comparison benchmark'. I also aligned classes with apps/lumen: h2.panel-title, aside.issue-side, form.bulk-form (table then bulk-bar), form.comment-form, form.logout-form, form.form.login-form / .issue-form, page-header with p.muted[issue-total] on project pages, search page without result count; tracker.css follows. React Router app (e975165) passes the suite via the conformance runner (15/15, streaming on). Dev server binds 127.0.0.1 (the harness probes 127.0.0.1; Vite's default 'localhost' resolves to ::1 on macOS).
<!-- SECTION:NOTES:END -->
