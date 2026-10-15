---
id: decision-60
title: Hold the parser after linked stylesheets instead of inlining more CSS
date: '2026-10-15 12:36'
status: accepted
---
## Context

Reloading a scrolled prerendered page painted its first frames at the wrong position, then jumped (TASK-278, found in the itsjavi.com port). On a reload, Chrome lays out the page when parsing ends, even if linked stylesheets have not loaded, restores the scroll position from that unstyled layout, and corrects it at `load`. Any linked stylesheet causes it, the shared file included. Measured on 30 reloads per page: 8 to 23 jumps on apps/web and ssg-travel-journal, 11 on the port. Inlining a page's own CSS at any size still jumped 5 to 13 times and cost 10 to 192 kB more per full visit; inlining all CSS fixed it but cost 40 to 649 kB more.

## Decision

Technical decision by Lux (decision-16), 2026-10-15, on Nova's TASK-278 findings.

- Pages that link a stylesheet get a short, non-empty inline script right after their stylesheet tags, in builds and in dev. The browser does not parse the body until the stylesheets before it have loaded, so the first layout, and the restored scroll position, use the styled page. An empty script does not wait.
- Under `csp: "strict"` the script gets the response's nonce or, in prerendered pages, its hash, through the existing CSP code.
- `INLINE_LIMIT` and the stylesheet grouping (TASK-121) stay as they are.
- Rejected: inlining every page's own CSS (still jumps, much heavier), inlining all CSS (fixes it, far heavier), raising `INLINE_LIMIT`.

## Consequences

- About 12 B brotli per page (59 B on a strict-CSP page with its hash). First paint is no later, since rendering already waited for the CSS.
- Tests that list a page's inline scripts exactly include the new one.
- 0 jumps in 30 reloads on every measured page after the change.
