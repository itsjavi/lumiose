---
id: DRAFT-5
title: 'Proposal: cancelable value changes for disclosure components'
status: Draft
assignee: []
created_date: '2026-10-16 13:26'
labels:
  - ui
  - proposal
milestone: m-12
dependencies:
  - TASK-443
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From Prism's release review (TASK-443 L5): Accordion, Tabs and Collapsible changes cannot be vetoed. The DOM changes first and onValueChange/onOpenChange report it after; Base UI passes eventDetails with cancel().

Needs the user's approval before anyone builds it: it changes the public API (a second argument, or a cancelable event).

Sketch (Halo, 2026-10-16):
- Tabs: the script decides the selection itself, so lu-tabs can fire a cancelable 'beforevaluechange' (detail: the next value) before #select; onValueChange(value, { cancel }) in islands maps to it. Clean.
- Accordion and Collapsible are native <details>: toggle is not cancelable and there is no beforetoggle for details. A veto there would have to revert after the toggle (one frame of the other state, and find-in-page or a #hash link would reopen), or intercept the summary's click and keys before the browser toggles (a click on <summary> is cancelable), which covers the trigger but not find-in-page or links.
- So: Tabs fully; Accordion and Collapsible only for the trigger (summary click and keys), documented as such, or not at all.
<!-- SECTION:DESCRIPTION:END -->
