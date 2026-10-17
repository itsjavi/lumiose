---
id: TASK-475
title: >-
  Security review: non-security notes (placement under strict CSP, Field bubble,
  Select multiple)
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:27'
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
- [x] #1 Each note is fixed with a test, or recorded with the reason it stays
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-17): (1) Placement under a strict CSP: place() reads only custom properties (--lu-side-offset, --lu-align-offset, kept by every browser's CSSOM in the data-l-v rules) and data-side/data-align, and writes through CSSOM, which a CSP allows, so positioning works in Firefox before 147 and Safari before 26 (by reading; no such browser in the e2e images). The anchor watcher was the gap, fixed: it reads position-anchor/anchor-name from the style attribute, else the computed style (a strict CSP's rules, in browsers with anchor positioning), and place() watches the trigger it was given (browsers without, where neither name can be read). Tests: placement/place.dom.test.ts and an e2e in popover.e2e.ts that turns style attributes into [data-l-v] rules as strict CSP renders them; both fail on the old place.ts. (2) Field: an Error part cancels the browser's bubble only for a problem it shows (any problem, or its match); a missing value in a field whose only Error is match=tooShort keeps the bubble, and aria-invalid. New fixture /form/matches and an e2e in field-attempt.e2e.ts (fails on the old script); field.md updated. (3) Select multiple stays: Select has no multiple by design (select.md, TASK-358: Combobox with multiple restores every value); the types omit it, so only an untyped attribute reaches it. Docs: script sizes current for popover 3.3, tooltip 2.0, preview-card 2.8, context-menu 4.6 kB (they share place.ts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Placement works under a strict CSP and its anchor watcher now finds the trigger from computed styles or the trigger place() is given; a Field's Error cancels the bubble only for problems it shows; Select multiple stays out of Select's API (Combobox covers it). Unit and e2e tests, field.md and size docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
