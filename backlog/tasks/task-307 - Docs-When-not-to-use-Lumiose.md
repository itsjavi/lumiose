---
id: TASK-307
title: 'Docs: When not to use Lumiose'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:17'
labels:
  - docs
milestone: m-11
dependencies: []
priority: medium
ordinal: 309000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). An honest page, linked from the stack comparison table on the site, the docs index and llms.txt, so people and agents recommend Lumiose only where it fits. It names the cases where another framework is the better choice: the project depends on the React ecosystem (Lumiose has no React interop, decision-54); the team needs long-term stability guarantees today (0.x, decision-47 and decision-53); the team cannot take a pre-1.0 dependency with one maintainer. Each case says what to use instead. Current API only (decision-47).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The page names the three cases above, each with what to use instead
- [x] #2 It is linked from the site's stack comparison, the docs index and llms.txt
- [x] #3 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 2): started. Page docs/when-not-to-use.md under Start here; linked from the landing's stack comparison.

Done. docs/when-not-to-use.md (Start here): the three cases (depends on the React ecosystem -> Next.js or React Router, Astro with React islands for content; needs long-term stability today -> a post-1.0 framework with a support policy; cannot take a pre-1.0 one-maintainer dependency -> a framework with a company or a large team behind it), each with what to use instead and when to look again. Linked from the landing's stack comparison (a note under the table), the docs index (so llms.txt) and the root README under the compare table. Screenshot: backlog/assets/task-307-compare-note.png. Validation: docs:gen, docs:check, docs and site content tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
When not to use Lumiose page with three cases and alternatives, linked from the stack comparison, the docs index, llms.txt and the README.
<!-- SECTION:FINAL_SUMMARY:END -->
