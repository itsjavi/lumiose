---
id: TASK-468
title: 'SVG: the SMIL animation check reads the attributes it emits (decoy bypass)'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: high
ordinal: 466000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**H1. SVG sanitizer: a decoy attribute lets a SMIL animation of `href` through.** This is stored XSS from an imported icon.
- **Files:** `crates/lumiose_svg/src/emit.rs`: `unsafe_animation` (around 228–243) against `attributes` (around 172–196). Owner: Halo.
- **Attacker:** the supplier of an `.svg` imported as a component: an npm icon set or a design hand-off. `concepts/svg.md` and `concepts/security.md` promise such an icon "can never run script". No runtime input is needed, and both the server and client renders are affected.
- **Cause:**
  - `unsafe_animation` reads `attributeName` and `values`/`from`/`to`/`by` with the first attribute that matches case-insensitively, in any namespace.
  - Emission keeps only the exact-case attribute with no namespace.
  - A decoy placed first (lowercase `attributename="fill"`, or a foreign-namespace `x:attributeName="fill"`) passes the check, while the real `attributeName="href"` is emitted.
  - In a `values` list, a script-scheme item that is not first also passes `is_script_url`, which only checks the start of the value.
- **Evidence:**
  - Prism, harmless payload (`values="#a;#b"`, no script): the plain animation is dropped, while the case decoy and the namespace decoy are both emitted with `attributeName=href`.
  - The helper reported script execution in Chromium with a script-scheme `values` list, also after the default SVGO pass (the namespace decoy survives SVGO). The payload is withheld.
  - The fuzz target `svg_component.rs` only asserts "no panic", so it cannot catch this.
- **Fix:**
  - Decide an animation's safety from the same attribute view that emission uses, or fail closed: drop the element when any attribute, in any case or namespace, names a link, a handler or a style target.
  - Check every item of `values` with `is_script_url`.
  - Add a property test and a fuzz invariant: no emitted animation targets `href`, `xlink:href`, `on*` or `style`.
- **Verification:** the decoy cases above produce no `<animate>`; legitimate animations of `fill`, `opacity` and `transform` are still emitted.
- **Confidence:** high. The bypass of the check is confirmed by Prism; execution was reported by the helper.
- **Task:** "SVG: SMIL animation check reads the attributes it emits (decoy bypass)"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decoy attribute, in another case or namespace, can't let an animation of href, xlink:href, on* or style through; every item of `values` is checked
- [ ] #2 A property test and a fuzz invariant: no emitted animation targets href, xlink:href, on* or style
- [ ] #3 Legitimate fill, opacity and transform animations are still emitted
<!-- AC:END -->
