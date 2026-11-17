---
id: TASK-608
title: 'Docs layout: words beside the code they describe'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 600000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild DocsShell and DocArticle to the reference: a slim sidebar, a large page head, and sections laid out as prose on the left with their code and result on the right; step pages get a sticky step bar. The layout is derived from the existing Markdown structure (a section, its prose, its code blocks): no new authoring syntax. If new syntax seems needed, propose it to the user first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A section with prose and code renders as two columns on desktop and stacks on phones; a section without code stays one readable column
- [ ] #2 Pages with numbered steps get the sticky step bar, built from their headings
- [ ] #3 Sidebar, search, previous and next links and the on-page anchors keep working; URLs do not change
- [ ] #4 llms.txt, llms-full.txt and the Markdown sources are unaffected by the layout
- [ ] #5 docs:check, the docs tests and the web e2e and a11y suites pass
<!-- AC:END -->
