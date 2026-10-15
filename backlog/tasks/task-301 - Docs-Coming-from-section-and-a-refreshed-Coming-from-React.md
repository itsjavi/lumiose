---
id: TASK-301
title: 'Docs: Coming from section and a refreshed Coming from React'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 04:40'
labels:
  - docs
milestone: m-10
dependencies: []
priority: medium
ordinal: 303000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants Coming from guides for React Router, Next.js, React and Solid (2026-10-15). Coming from React already exists (TASK-232, packages/lumiose/docs/coming-from-react.md). Give the four guides a section of their own in the docs (index, site navigation, llms.txt), move Coming from React into it and refresh it against the current API.

The guides map concepts to the current API only; they are not migration or upgrade guides (decision-47). They share one outline so people and agents find things in the same place: mental model, a table from the other framework's APIs to Lumiose's, what has no equivalent and what to do instead, an example, related pages. M10's feature tasks update the guides as they land.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The docs have a Coming from section listing the four guides, in the docs index, the site navigation and llms.txt
- [x] #2 Coming from React lives in that section, refreshed against the current API, and links to it resolve
- [x] #3 The shared outline for the guides is set
- [x] #4 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (M10 batch 1, worktree beacon-m10): started. Plan: docs/coming-from/ with a section README holding the shared outline; react.md moved from coming-from-react.md and refreshed; docs index, site nav (from the index), llms.txt, CLI section order and the docs contract test cover the section.

Committed the section, the refreshed React guide and the outline contract test (5532ade5). The index lists the other three guides as TASK-302 to TASK-304 land; Done after that.

Done. Section: docs/coming-from/{react,nextjs,react-router,solid}.md, a '## Coming from' section in docs/README.md (so the site navigation, which reads the index, and llms.txt list them), 'coming-from/' in the CLI's reading order (lumiose docs react-router resolves). The shared outline is stated in the docs index and enforced by the docs contract test: Mental model, From <framework> to Lumiose, What has no equivalent, Example, Common mistakes, Related (### subsections allowed). React refresh: React 19 rows (use(), server components, 'use client', server actions and <form action>, useActionState, useFormStatus, document metadata, createRoot), a What has no equivalent table, island guidance and an example using <Title> instead of document.title in an effect (head.md lists that as a mistake). Links updated in the root README, packages/lumiose/README.md, the landing page CTA and the footer (site.ts). No redirect from the old /docs/coming-from-react URL (decision-47: no compatibility paths). Screenshots: backlog/assets/task-301-coming-from-nav.png (navigation), backlog/assets/task-303-nextjs-table.png (a guide table). Validation: docs:gen, docs:check, packages/cli/src/docs tests (contract and type-checked examples) and apps/web content tests green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A Coming from section in the docs (index, site navigation, llms.txt, CLI) with four guides on one shared outline, enforced by the docs contract test; Coming from React moved into it and refreshed for React 19.
<!-- SECTION:FINAL_SUMMARY:END -->
