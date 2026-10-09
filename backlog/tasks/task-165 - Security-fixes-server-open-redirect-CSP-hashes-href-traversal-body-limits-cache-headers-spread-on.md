---
id: TASK-165
title: >-
  Security fixes (server): open redirect, CSP hashes, href traversal, body
  limits, cache headers, spread on*
status: Done
assignee:
  - Nova
created_date: '2026-10-09 12:01'
updated_date: '2026-10-09 12:24'
labels:
  - security
  - server
milestone: m-7
dependencies: []
priority: medium
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-162 (Prism): M1 trailingSlash redirect builds Location from url.pathname, so GET /a/..//evil.com → 308 //evil.com (handler.ts:666-677, match.ts:72-79) — collapse leading slashes / skip; M3 hashPolicy hashes every <script>/<style> in the output by regex (csp.ts:39-52), allowlisting injected HTML — collect hashes from what Lumen/JSX emit instead (decision-27); M4 fillPattern/href let '.'/'..' params traverse (href.ts:39-66) — throw on them; L5 request.formData() buffers unbounded (actions.ts:53-56) — body-size limit in adapter-node + bounded parsing; L6 nonce'd HTML has no Cache-Control — send 'private, no-store' on strict-CSP nonce responses unless the app sets one (documented); L1 server spread emits lowercase on* attributes (attrs.ts:157) — drop /^on/i like React (keep parity with Spark's client fix). Also: redirect() rejects non-http(s) schemes server-side (pairs with Spark's TASK for M2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each item fixed with a regression test (probes in .local/agents/Prism/prism-20261009T1200Z/app/)
- [x] #2 security.md documents body limits, redirect safety (same-origin recipe for user-supplied next URLs), cache headers with CSP
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (TASK-166): client spread now drops /^on/i non-handler keys; when you change server/attrs.ts NOT_ATTRIBUTE, add an onclick: "alert(1)" key to the props of server/parity.test.ts 'spread parity' so both sides stay checked. Client navigate()/action redirects throw on non-http(s) URLs (navigationUrl in app/actions/navigation.ts).

Nova 2026-10-09: M1 trailing-slash redirects collapse leading slashes (GET //evil.com/ with never -> Location /evil.com; adapter-node statics did the same in TASK-164). M3 per decision-27: prerendering renders with a marker nonce on everything Lumen/JSX emit; withHashPolicy hashes only marked inline scripts/styles and strips the marker, so raw HTML strings get neither nonce nor hash. M4 fillPattern/href() throw on '.'/'..' params (rest params per segment). L5 body limits: done once in TASK-167 (decision-29). L6 strict-CSP nonce responses get Cache-Control: private, no-store unless the page/middleware sets one. L1 server spreadAttrs drops /^on/i keys (server/attrs.ts NOT_ATTRIBUTE; Spark: one-line change in your TASK-168 file, client side was already /^on/i) with a parity test. redirect() throws a TypeError for non-http(s) schemes (control chars stripped before reading the scheme). Tests: request-target.test.ts (open redirect, redirect schemes), href.test.ts, csp.test.ts (marker-only hashes, cache-control), parity.test.ts. Docs: security.md (prerender hashes, cache headers, redirect safety with a same-origin next recipe, href dots).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Open redirect via trailingSlash fixed, hash policies only for Lumen/JSX-emitted inline code, href() refuses dot params, private no-store on nonce'd pages, server spread drops lowercase on*, redirect() refuses non-http(s); body limits landed in TASK-167; security.md updated.
<!-- SECTION:FINAL_SUMMARY:END -->
