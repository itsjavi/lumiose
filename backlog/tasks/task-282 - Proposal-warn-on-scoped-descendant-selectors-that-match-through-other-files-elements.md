---
id: TASK-282
title: >-
  Proposal: warn on scoped descendant selectors that match through other files'
  elements
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-23 08:17'
labels:
  - proposal
  - css
  - diagnostics
dependencies: []
priority: low
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 5. Scoping adds the token to a selector's last compound only, so .posts a in one file also matched that file's <a> inside another file's .posts element: the home page's post cards lost their padding until the class was renamed. Astro scopes every compound. Options: (a) document it in styles.md common mistakes; (b) a diagnostic when an ancestor class of a descendant selector is not used in the file; (c) an option to scope every compound. A new diagnostic or option needs a decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded, and styles.md documents the behaviour either way
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-23), from the private-app port (TASK-492): a real bug from this. A card component's rule .card:hover .tile was scoped only on .tile, so the tiles of every card in a graph took their hover style (highlighted and scaled) whenever the pointer was over the graph's section, which another component also styles as .card. The port renamed its classes to unique ones. Scoping each compound, or at least each class of a descendant selector, would have prevented it.
<!-- SECTION:NOTES:END -->
