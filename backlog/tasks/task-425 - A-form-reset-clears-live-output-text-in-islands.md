---
id: TASK-425
title: A form reset clears live <output> text in islands
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-16 05:22'
labels:
  - runtime
  - dom
milestone: m-12
dependencies: []
priority: medium
ordinal: 423000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-424 (2026-10-16). In Firefox and WebKit, a form reset replaces the contents of an <output> inside the form with its default value. An island that renders reactive text inside such an <output> loses the text node the runtime updates, so later updates stop showing. Field.Error now restores its own text after a reset; other <output> elements in islands still break. Either the runtime keeps reactive content in a reset <output> working (re-attach after the form's reset event), or the docs warn and @lumiose/ui avoids <output> for reactive text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reactive text in an <output> inside a form keeps updating after a reset in Firefox and WebKit, with a test, or the limit is documented with the reason
<!-- AC:END -->
