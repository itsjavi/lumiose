---
id: TASK-167
title: 'Security: adapter-node hardening (from TASK-162 adapter review)'
status: Done
assignee:
  - Nova
created_date: '2026-10-09 12:02'
updated_date: '2026-10-09 12:20'
labels:
  - security
  - adapter
milestone: m-7
dependencies: []
priority: high
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism's adapter review (probes in .local/agents/Prism/prism-20261009T1200Z/adapter/): H1 no request body limit — a 128 MB urlencoded POST without Origin is buffered by formData() (RSS 104→517 MB), endpoints' arrayBuffer() likewise; M1/L4 '//host' and absolute-form targets set the authority (covered by TASK-164; static.ts:73 has the same bug: GET //robots.txt serves index.html); M2 BREACH: on-the-fly compression on reflected input + Set-Cookie — document the risk and the no-transform/compress:false opt-outs; L1 path-scoped lumen({ headers }) rules match the raw URL, not the router's normalized pathname (/x/../admin/page skips the rule); L2 the static index follows symlinked dirs out of dist/client and one unreadable entry empties the whole index; L3 malformed requests (TRACE, bad Host) return 500 with a logged stack — return 400/405/501 without console.error; L5 everything under assets/ is immutable, not only hashed files; L6 /_headers and .br/.gz siblings are directly fetchable; L7 Node default timeouts — document reverse proxy + tuning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 H1: default body limits enforced early (Content-Length) and while streaming (413), for actions and a helper for endpoints — the default values and any public option need the user's approval (pending in chat); implement internals behind a constant until approved
- [x] #2 L1, L3, L5, L6 fixed; L2: per-entry error handling (never empty the index) and a startup warning for symlinks escaping dist/client (containment by default pending approval); M2 and L7 documented in adapter-node.md/security.md; regression tests for each
- [ ] #3 decision-29 options implemented with tests and docs: limits (global + per route + endpoint helper), default nosniff/Referrer-Policy headers, signed cookie secret check with allowWeakSecret, adapter-node symlinks option
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: decision-29 approves the public shapes: lumen({ limits: { body: "1mb", upload: "10mb" } }) + route export const limits + an endpoint body helper; default headers X-Content-Type-Options: nosniff and Referrer-Policy: strict-origin-when-cross-origin (overridable via lumen({ headers })); signedCookie throws in production for secrets < 32 bytes, warns in dev, allowWeakSecret: true opts out; adapter-node keeps following symlinks with a startup warning for escapes and symlinks: "contain" as an option; Node default timeouts stay, documented.

Nova 2026-10-09 (a5b3a5e + this commit). H1 per decision-29: every request body is bounded in the request handler (app/server/body.ts): body 1 MB (urlencoded, JSON, other), upload 10 MB (multipart); 413 before reading on Content-Length, else while streaming (the handler wraps request.body; a route's export const limits replaces the app's once its module loads, then Content-Length is re-checked). Options: lumen({ limits: { body, upload } }) (sizes as bytes or '512kb'/'1mb'; validated in vite/options.ts; plumbed to dev, build entry and adapters) and route export const limits (pages and endpoints). The endpoint 'body helper' turned out unnecessary: endpoints read the bounded ctx.request (formData/json/text/arrayBuffer give 413) — documented; if a named helper is still wanted that is a DX naming decision for the user. Actions' ctx.formData() reads the bounded body (400 for non-forms). The Node bridge no longer caps on its own. L1: pathBelowBase normalizes dot segments (header rules match /x/../admin as /admin). L3: lumen/node RejectedRequest (400 bad target/Host/header, 405 TRACE/TRACK, 501 CONNECT, 400 for an invalid method/header) answered by adapter-node and lumen dev without logging. L5: immutable only for hashed names (name-[hash].ext with a digit or uppercase), other assets/ files revalidate. L6: _headers and .br/.gz copies are not served as files. L2: the static index walks per directory (an unreadable entry is skipped with a warning, never empties the index), follows symlinks with a startup warning listing escapes, and adapter-node symlinks: 'contain' (createServer/createHandler/createStaticHandler option) leaves them out. Defaults per decision-29: X-Content-Type-Options nosniff and Referrer-Policy strict-origin-when-cross-origin in headersFor() (adapter-node, lumen dev, lumen preview) and in dist/client/_headers (now always written; '' removes a header, '! name' in _headers). signedCookie: secrets < 32 bytes throw in production / warn once in dev, allowWeakSecret opts out; bookshelf's dev/e2e secrets lengthened. M2 (BREACH: no-transform per response / compress:false) and L7 (Node default timeouts, proxy, tuning via LumenServer.server) documented in reference/adapter-node.md. Tests: request-target.test.ts (413 declared/streamed for actions and endpoints, route limits, upload limit, lumen({ limits }), TRACE 405, normalized header paths), adapter-node static.test.ts (hashed immutable, _headers/.br hidden, unreadable dir, symlink warning, contain), request-target.test.ts (default headers on statics and app), headers.test.ts, cookies.test.ts, options/build tests updated. Docs: security.md, adapter-node.md, vite.md, routing.md, server.md, app.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bounded bodies with lumen({ limits }) and route limits (413), malformed requests 400/405/501 without logs, header rules on normalized paths, hashed-only immutable caching, hidden _headers/.br/.gz, robust static index with symlink warning and symlinks: 'contain', default nosniff/referrer headers, 32-byte signed-cookie secrets; BREACH and timeouts documented.
<!-- SECTION:FINAL_SUMMARY:END -->
