---
id: TASK-138
title: 'Implement lumen({ csp: "strict" }) end to end'
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:55'
updated_date: '2026-10-09 05:20'
labels:
  - security
  - app
  - css
dependencies: []
priority: medium
ordinal: 138000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec doc-1 §7.4 designs csp: "strict" (nonce'd <style> rules for style props in SSR, nonces on scripts) but reference/vite.md says the option is not available yet. TASK-121 added inlined page CSS (<style> without a nonce) and the island loader/records and streamed Suspense scripts are inline too. Lux authorises edits in packages/lumen/src/{app,server}/**, app/production/**, vite/options.ts and adapter-node for this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen({ csp: "strict" }) generates a per-request nonce (exposed to middleware/document) and applies it to every inline script and style Lumen emits: inlined page CSS, style-prop rules, island records, loader, streamed Suspense swaps; static/prerendered pages fall back to linked CSS and hashes or external scripts where a nonce is impossible
- [x] #2 A Content-Security-Policy header is set (overridable by headers/middleware) and a Playwright test with a strict policy shows no CSP violations on the three sample apps' key pages
- [x] #3 Docs: reference/vite.md, a security/CSP section; spec §7.4 matches
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-09): plan. Per request (server routes, dev): nonce per response (crypto, 128 bits), on every inline script/style/modulepreload Lumen writes (core already nonces loader, swaps and strict-style rules; the handler nonces head assets incl. TASK-121 inline CSS, speculation rules, View Transitions style, plus <meta property=csp-nonce> for the preload helper); style props render as data-l-v rules (core strictStyles). Header: script-src 'nonce-N' 'strict-dynamic'; style-src 'self' 'nonce-N'; object-src 'none'; base-uri 'self', unless setHeader/middleware set one; not in dev (Vite injects un-nonced styles for HMR). Prerendered pages: no nonce; <meta http-equiv=Content-Security-Policy> first in <head> with sha256 of every executable inline script/style, 'self' for external ones. API: cspNonce() from lumen (accessor, like url()), for the app's own inline scripts (needs user approval as public API; flagged). Done in 1e18311 (handler/core/accessor + tests). Pending: lumen({ csp }) option plumbing (shared files with TASK-125, waits for it), headers-option precedence, Playwright strict checks, docs/spec. Limitations: static style attributes compiled into templates and style attributes inside .md/.html content are not covered (no 'unsafe-inline').

Halo (2026-10-09): part B. lumen({ csp: "strict" }) option (vite/options.ts, validated; project.ts; dev plugin; app.ts/BuiltApp.csp; server entry data from the production plugin). A Content-Security-Policy configured with lumen({ headers }) for the path replaces Lumen's (handler gets headers; no header, no prerender <meta>), as do setHeader/middleware. Hash <meta> goes after <meta charset>. Samples run strict: ssg-travel-journal (hash meta; document theme script uses nonce={cspNonce()}), ssr-bookshelf (new vite.config.ts; nonce header on server pages, hash meta on (static) pages), spa-chiptune (hash meta on shells, nonce'd in dev; PixelLogo's <svg><style> moved to a file-level block since SVG-native <style> is inline CSS). Each has a strict-CSP Playwright test listening to securitypolicyviolation (journal's also proves the check is not vacuous); full suites: journal 17, bookshelf 15, chiptune 20 (dev + preview) pass. Docs: new concepts/security.md (+ README index), reference/app.md cspNonce(), reference/vite.md csp; spec doc-1 §7.4 updated. Validation: vitest lumen/src + adapter-node + journal 897 pass, dev-server.test.ts 13, lumen typecheck, samples' lumen check, oxlint, docs:check. Follow-up TASK-142 (Photon): static style attributes, <svg><style>, content-import inline styles under strict CSP. Needs user approval (public API): cspNonce() from lumen (and its browser variant reading <meta property=csp-nonce>).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen({ csp: "strict" }) works end to end: per-response nonces on every inline script/style/module preload Lumen writes plus cspNonce() for the app, a CSP header (replaced by headers/setHeader/middleware), hash-policy <meta> for prerendered pages, style props as nonce'd rules. The three sample apps run strict with Playwright checks; docs (concepts/security.md, references) and spec §7.4 updated. Follow-up: TASK-142; cspNonce() awaits user approval.
<!-- SECTION:FINAL_SUMMARY:END -->
