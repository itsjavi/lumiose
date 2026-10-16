---
id: TASK-443
title: 'Release review, Low: Disclosure'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 441000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Disclosure. Fix each, or record why it stays.

**Disclosure**
- **L5.** Proposal: Accordion, Tabs and Collapsible changes can't be vetoed. The DOM changes first; BU has `cancel()`. Task: "Proposal: cancelable value changes for disclosure components".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L5: Proposal: cancelable value changes for disclosure components
<!-- AC:END -->
