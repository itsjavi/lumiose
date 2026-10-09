---
id: TASK-108
title: Reject <script> in Markdown imports
status: To Do
assignee:
  - Halo
created_date: '2026-10-09 04:03'
labels:
  - content
  - diagnostics
dependencies: []
priority: medium
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-09 (decision-22 amendment): <script> is not supported in .md files. Only .html imports run scripts. TASK-69 currently loads Markdown <script>s like .html ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A <script> element in a .md file (raw HTML block or inline) is a build/dev error with a registered LUM diagnostic, file and line, pointing to an .html import or a component; .html behaviour is unchanged
- [ ] #2 Tests in lumen_content and the Vite plugin; docs (concepts/content.md, errors/<id>) updated in the same commit; docs:gen/docs:check green
<!-- AC:END -->
