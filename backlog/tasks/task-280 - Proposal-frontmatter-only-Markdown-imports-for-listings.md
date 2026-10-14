---
id: TASK-280
title: 'Proposal: frontmatter-only Markdown imports for listings'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - proposal
  - content
  - css
dependencies: []
priority: medium
ordinal: 282000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 3. A content layer that imports every .md module eagerly (import.meta.glob with eager: true) to list posts also pulls every file's component and scoped <style> into every page: the port's home page stylesheet carries the blog post's CSS. Lumiose already generates an internal ?lumiose-frontmatter module per file. Options: (a) a public ?frontmatter query (frontmatter and headings without the component); (b) a small collections API (defineCollection/getCollection/getEntry, the port's src/lib/content.server.ts is about 150 lines). Any new query or API name needs the user's approval.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded, with the user's approval for any new import query or API
<!-- AC:END -->
