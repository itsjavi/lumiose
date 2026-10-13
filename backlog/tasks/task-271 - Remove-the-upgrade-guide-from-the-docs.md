---
id: TASK-271
title: Remove the upgrade guide from the docs
status: Done
assignee:
  - Lux
created_date: '2026-10-13 23:45'
updated_date: '2026-10-13 23:51'
labels: []
dependencies: []
ordinal: 273000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-14: no migration paths or upgrade docs before real usage. Remove docs/upgrading.md and its index entry, regenerate llms files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 upgrading.md and every link to it are gone; docs:check and docs tests green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: removed docs/upgrading.md and its index entry (the only upgrade content in the docs; no site nav, CLI or template references). llms files regenerated; docs:check, apps/web content, cli docs and docs tests green (34).
<!-- SECTION:NOTES:END -->
