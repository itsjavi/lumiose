---
id: TASK-438
title: 'Release review, Medium: Combobox, Autocomplete, Select'
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 14:18'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: medium
ordinal: 436000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Combobox, Autocomplete, Select. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M19. Combobox: text typed after the popup closed itself stays after blur.** CONFIRMED in 3 engines.
- **Repro:** `/combobox/island`, Fruit (Pear). Type "zz", then click the heading. The input shows "zz" while the value and signal stay "pear", so the form submits a value the user can't see.
- **Violates:** doc-9 §6 "closing without a selection restores the input text"; BU test.
- **Fix:** on focusout to nowhere with the popup closed, `#showLabel()` (not in free mode).

**M20. Combobox/Autocomplete: browser autofill opens the popup on an unfocused field and loses the value.** CONFIRMED with simulated events in Chromium and WebKit.
- **Violates:** doc-9 §6; BU autofill tests.
- **Fix:** autofill-like input (no `inputType`, or `insertReplacementText`) and an unfocused input never open or filter; select an exact label or value match.

**M21. Combobox/Autocomplete (and layer.ts): Safari's IME-committing Enter (`keyCode` 229, after compositionend) picks the highlighted option.** CONFIRMED with WebKit's sequence simulated.
- Filtering also runs on uncommitted kana ("No city matches").
- **Violates:** doc-9 §1 and §6; BU IME tests; Zag `isComposingEvent`.
- **Fix:** treat keyCode 229 as composing; filter after compositionend.

**M22. Combobox: a Status inside a Popup never shows while there are no options, including combobox.md's async example.** CONFIRMED.
- **Violates:** WCAG 4.1.3; the docs.
- **Fix:** `#showable()` counts a Status with text, or the docs move Status outside the Popup.

**M23. Combobox: Empty and Status live regions are `hidden` until shown, with no VoiceOver delay mitigation.** SUSPECTED: DOM confirmed, no screen reader run.
- BU keeps them mounted and adds the word-joiner mutation; toast already has the mitigation.

**M24. Combobox server HTML: the input is empty for a selected value, and Clear and Trigger show but do nothing before the upgrade.** CONFIRMED.
- Text typed before the upgrade is overwritten: Chromium shows "Lisbon"; WebKit shows "LisbonBer".
- **Fix:** server-render the label as `value`; don't overwrite text that differs from defaultValue; hide `[command]` buttons until `:defined`, as Number Field does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M19: Combobox: restore the label on blur after a no-match close
- [ ] #2 M20: Combobox: handle browser autofill like Base UI
- [ ] #3 M21: Combobox: Safari IME guard and no filtering mid-composition
- [ ] #4 M22: Combobox: Status in a Popup shows while searching
- [ ] #5 M23: Combobox: announce Empty and Status reliably
- [ ] #6 M24: Combobox: server-render the label; no clobbering before upgrade
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).

2026-10-16 (Beacon): Fixed M19, M20, M21 (Combobox part), M22, M24 (buttons, pre-upgrade text) in combobox.script.ts / combobox.css; tests in ui-e2e combobox-review.e2e.ts (new; fixture /combobox/status with a Status inside the Popup), each failing without the fix in Chromium (build), Firefox and WebKit and passing in all three. M19: focus leaving to nowhere with the popup closed puts the selection's label back (non-free). M20: an input event on an unfocused input, or with inputType insertReplacementText, is autofill: no popup, no filter; an exact (folded) label or value match chooses the option, else the label comes back; free mode keeps the text. M21: input events with isComposing do not filter; compositionend filters the committed text; Enter with keyCode 229 (Safari's committing Enter after compositionend) chooses nothing. M22: #showable counts a Status in the popup with text. M24: text typed before the upgrade (input.value !== defaultValue) is kept and filtered; `lu-combobox:not(:defined) [command]` is hidden. combobox.md updated. Left for decisions: (1) M24's server-rendered label: the Input renders before the Items, so the server cannot know the selected option's label when it writes the input; the script fills it on upgrade (proposal: keep, documented; an option would be a `label` prop on Root for the server). (2) M23 (SUSPECTED, no screen reader run): Empty and Status mounted hidden until shown, without VoiceOver's delay mitigation: belongs to the parked screen reader pass (TASK-361's checklist). (3) M21's layer.ts part (Enter key 229 in Menu-like layers) is Halo's area (layers), not touched. Status stays In Progress until the user agrees on (1) and (2).

2026-10-16 (Halo): M21's layer part done (fix batch 2). layer.ts exports composing(event) (isComposing, or keyCode 229: Safari's key that commits or cancels a composition comes after compositionend with isComposing false); the shared Escape handler ignores such keys, so an Escape that ends a composition in a field inside a Popover, Menu or Navigation Menu content closes nothing and is not cancelled. dialog.script's Escape handler does the same. Unit test in layer.dom.test.ts fails without it. dialog.md and popover.md keyboard tables mention it. Menu items and other layers' keys hold no text field, so no other guard is needed there.
<!-- SECTION:NOTES:END -->
