---
id: TASK-499
title: 'SVG imports: two bypasses of the external-reference filter (Low)'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: medium
ordinal: 495000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding C2 (TASK-474 L2 not closed): (a) crates/lumiose_svg/src/prefix.rs:154 skips nesting beyond MAX_CSS_DEPTH (64), so 70 nested @media all{ blocks keep url(https://…); (b) emit.rs:312 runs style_text after the filter: li{list-style:\&lt;url(https://h/x)} is one ident for cssparser but is emitted as \\3c url(…), a url token for browsers. Chromium, Firefox and WebKit all requested both URLs. Impact: an imported icon can beacon viewers; no script.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both inputs lose their external url() (tests/security.rs and the fuzz invariant)
- [ ] #2 At the depth limit the block is dropped or the import fails, as check_depth does
<!-- AC:END -->
