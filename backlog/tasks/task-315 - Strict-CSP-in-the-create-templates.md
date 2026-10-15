---
id: TASK-315
title: Strict CSP in the create templates
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:21'
labels:
  - security
milestone: m-11
dependencies: []
priority: medium
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: every template of @lumiose/create sets lumiose({ csp: "strict" }); the framework default stays off. The templates' own scripts and styles must work under it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every create template sets csp: "strict" and its pages run without CSP violations
- [x] #2 Getting started and concepts/security.md say that new projects start with a strict CSP
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 2): started.

Done. packages/create/src/scaffold.ts writes lumiose({ mode, csp: "strict" }) into every template's vite.config.ts (with a comment), and the generated README says so. Verification: create.test.ts gains 'serves its pages under the strict CSP with lumiose preview': for each template (minimal, static, ssr, spa) it builds, serves with lumiose preview, crawls the pages linked from home and checks that a strict policy is served (header with nonce + strict-dynamic, or a prerendered <meta> with hashes), that every inline executable script and every inline style carries the nonce or matches a hash, and that no element has a style attribute or inline event handler (it fails with csp removed: checked). Browser check of built spa, ssr and static templates in the browser pane: no CSP violations in the console (the console does report injected violations: checked), SPA hydration and client navigation, and the ssr guestbook form post all work. The templates needed no changes. Docs: getting-started.md and concepts/security.md say new projects start with a strict CSP; packages/create/README.md too. Validation: create, docs and site content tests, create-lumiose typecheck, docs:check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every create-lumiose template enables lumiose({ csp: "strict" }); a test serves each built template and checks its pages against the policy; Getting started and Security say new projects start with a strict CSP.
<!-- SECTION:FINAL_SUMMARY:END -->
