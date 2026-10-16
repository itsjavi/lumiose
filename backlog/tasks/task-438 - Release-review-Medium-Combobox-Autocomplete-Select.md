---
id: TASK-438
title: 'Release review, Medium: Combobox, Autocomplete, Select'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
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
