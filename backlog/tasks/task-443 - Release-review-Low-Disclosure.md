---
id: TASK-443
title: 'Release review, Low: Disclosure'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:26'
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
- [x] #1 L5: Proposal: cancelable value changes for disclosure components
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): L5 is a proposal (public API): recorded as draft-5, 'Proposal: cancelable value changes for disclosure components', for the user's decision, with a sketch (Tabs can veto cleanly through its script; Accordion/Collapsible are native <details>, whose toggle cannot be cancelled, so only the trigger's click and keys could be). Nothing built.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L5 recorded as a draft proposal (draft-5) for the user's decision; nothing built.
<!-- SECTION:FINAL_SUMMARY:END -->
