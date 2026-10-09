---
id: TASK-138
title: 'Implement lumen({ csp: "strict" }) end to end'
status: To Do
assignee:
  - Halo
created_date: '2026-10-09 04:55'
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
- [ ] #1 lumen({ csp: "strict" }) generates a per-request nonce (exposed to middleware/document) and applies it to every inline script and style Lumen emits: inlined page CSS, style-prop rules, island records, loader, streamed Suspense swaps; static/prerendered pages fall back to linked CSS and hashes or external scripts where a nonce is impossible
- [ ] #2 A Content-Security-Policy header is set (overridable by headers/middleware) and a Playwright test with a strict policy shows no CSP violations on the three sample apps' key pages
- [ ] #3 Docs: reference/vite.md, a security/CSP section; spec §7.4 matches
<!-- AC:END -->
