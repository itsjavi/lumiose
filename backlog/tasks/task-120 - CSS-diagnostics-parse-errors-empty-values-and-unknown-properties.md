---
id: TASK-120
title: 'CSS diagnostics: parse errors, empty values and unknown properties'
status: To Do
assignee:
  - Halo
created_date: '2026-10-09 04:20'
labels:
  - css
  - diagnostics
dependencies: []
priority: medium
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 6. In <style>, colr: red, color: ; and an unclosed { produce no diagnostic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Lightning CSS parse/recovery warnings surface as LUM diagnostics with locations; unknown properties warn (vendor-prefixed and --* allowed)
- [ ] #2 Tests and errors/<id> docs
<!-- AC:END -->
