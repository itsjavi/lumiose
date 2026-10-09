// The markup contract of the Tracker app (doc-4 §5). The reference markup is @bench/react-ui
// (shared by the React Router and Next apps); the Lumen app renders the same elements, classes and
// `data-testid`s. The conformance suite (tracker.e2e.ts) and the harness rely on these:
//
// Layout (every HTML page, the 404 page included)
//   app-header             <header>; nav holds links to /, /issues/new and /search
//   current-user           always present: `.user-name` (display name) + logout-button (a submit
//                          button in a form posting to /logout) when signed in, login-link otherwise
//   sidebar                <aside> with 12 sidebar-project links (/projects/<slug>), each with `.count`
//   main                   <main>; each page has one <h1>
//   app-footer             contains "fullstack comparison benchmark" (the harness edits it to time HMR)
//
// /                        stat-{open,in_progress,closed} (issues by status) and
//                          stat-{low,medium,high,urgent} (unresolved issues by priority), each with
//                          `.stat-value`; project-table with 12 project-row; recent-issues list of
//                          10 items with `.issue-link`
// /projects/:slug          a GET form with filter-submit and fields status, priority, label, sort, q;
//                          issue-table with up to 50 issue-row (data-issue-id), each with row-select
//                          (checkbox name=ids), `.issue-link`, `.badge.status-<s>`,
//                          `.badge.priority-<p>`, `.labels > .label`; pagination with page-info
//                          ("Page N of M"), page-prev / page-next links when they exist (filters kept);
//                          bulk select: selected-count ("N selected") and close-selected
// /issues/:id              issue-title (<h1>), issue-status (status and priority badges, project
//                          link), issue-body, assignee, reporter, issue-labels (when there are labels);
//                          status-select + status-submit; comments-loading while streaming, then
//                          comment-count ("N comments") and comment-list of comment items
//                          (`.comment-meta strong` author, `.comment-body`); composer: comment-input
//                          (textarea name=body), char-count ("N / 2000"), comment-submit, comment-error
// /issues/new              fields title, body, project, priority, hidden labels (names joined by ",");
//                          label-picker with 15 label-chip toggle buttons (aria-pressed); create-issue;
//                          error-<field> messages
// /search?q=               a GET form to /search with search-input; suggestions list of suggestion
//                          items (links to /issues/<id>, at most 8); search-results of search-result
// /login                   username field, login-submit, error-username
// 404                      not-found inside the layout, status 404
// /api/issues/:id          JSON of getIssue(id); 404 when unknown
// /api/search?q=           JSON array of searchIssues(q, 8)
//
// Readiness: every page sets `window.__benchReady = performance.now()` once its interactive parts
// are hydrated or attached (pages without any: when the document is parsed). Tests and the harness
// wait for it before interacting.

export const tid = (id: string): string => `[data-testid="${id}"]`;

/** The form that contains the element with this test id. */
export const formOf = (id: string): string => `form:has(${tid(id)})`;

export const STATUSES = ["open", "in_progress", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** A seeded user (doc-4 seed): log in with this name. */
export const USERNAME = "alice";
