// The markup contract of the Tracker app (doc-4 §5). Every app (Lumen, React Router, Next) renders
// these `data-testid` landmarks; the conformance suite (tracker.e2e.ts) and the harness find
// elements only through them, plus the form field names listed here.
//
// Layout (every HTML page, the 404 page included)
//   site-header            <header>; links nav-home (/), nav-search (/search), nav-new-issue (/issues/new)
//   current-user           signed in: the username; next to logout-form (<form method=post action=/logout>)
//   login-link             signed out: <a href="/login">
//   sidebar                <aside> with 12 sidebar-project links (href /projects/<slug>), each holding
//                          sidebar-project-count (open issues, a plain integer)
//   site-footer            <footer> containing the text "Tracker benchmark" (the harness edits it to time HMR)
//   page-title             the page's <h1> (on /issues/:id it is the issue title)
//
// /                        stat-status-{open,in_progress,closed}, stat-priority-{low,medium,high,urgent},
//                          each holding stat-value (a plain integer); project-table with 12 project-row;
//                          recent-issues with 10 recent-issue, each holding an issue-link
// /projects/:slug          filter-form (method=get; fields status, priority, label, sort, q; submit button);
//                          issue-total (holds the integer total); issue-table with up to 50 issue-row
//                          (data-id=<issue id>), each holding issue-select (checkbox name=ids value=<id>),
//                          issue-link (href /issues/<id>), issue-status (data-status), issue-priority
//                          (data-priority), label-chip*, issue-assignee;
//                          pagination with page-current (the page number), page-prev (absent on page 1),
//                          page-next (absent on the last page), both links keeping the filters;
//                          bulk select: selected-count ("N selected") and close-selected (button)
// /issues/:id              page-title, issue-status (data-status), issue-priority (data-priority),
//                          issue-body, issue-labels (label-chip*), issue-project (link), issue-assignee,
//                          issue-reporter (the reporter's username), issue-created, issue-updated;
//                          status-form (method=post; select name=status; submit button);
//                          comments: comments-fallback while streaming, then comment-list of comment
//                          items (comment-author, comment-body) or comments-empty;
//                          comment-form (method=post; textarea name=body; char-count shows the
//                          number of typed characters; submit button)
// /issues/new              new-issue-form (method=post; input title, textarea body, select project,
//                          select priority, hidden input labels = the selected label values joined by
//                          ","); label-picker with label-option buttons (data-label=<value>,
//                          aria-pressed); field-error-<field> with the message when a field is invalid
// /search?q=               search-form (method=get action=/search; input name=q); search-suggestions
//                          with search-suggestion links (href /issues/<id>, at most 8);
//                          search-results with search-result items, each holding an issue-link
// /login                   login-form (method=post; input name=username; submit button);
//                          field-error-username for an unknown user
// 404                      not-found inside the layout, status 404
//
// Readiness: every page sets `window.__benchReady = performance.now()` once its interactive parts
// are hydrated or attached (pages without any: when the document is parsed). Tests and the harness
// wait for it before interacting.

export const tid = (id: string): string => `[data-testid="${id}"]`;

export const STATUSES = ["open", "in_progress", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
