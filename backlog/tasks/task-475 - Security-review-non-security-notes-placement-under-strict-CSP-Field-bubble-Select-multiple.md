---
id: TASK-475
title: >-
  Security review: non-security notes (placement under strict CSP, Field bubble,
  Select multiple)
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: low
ordinal: 473000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

## Non-security notes found on the way

- **`placement/place.ts:83-95` reads `anchor-name` from the `style` attribute.** Under strict CSP the anchor name lives in a `data-l-v` rule, so the no-anchor-positioning fallback's clipped-anchor hiding (`data-anchor-hidden`) never applies. Check placement itself under strict CSP in Firefox before 147 and Safari before 26.
- **A Field whose only Error is `match="tooShort"`** still suppresses the browser bubble for `valueMissing`, so the user sees no message.
- **Select `multiple`** restores only the first of its `values`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each note is fixed with a test, or recorded with the reason it stays
<!-- AC:END -->
