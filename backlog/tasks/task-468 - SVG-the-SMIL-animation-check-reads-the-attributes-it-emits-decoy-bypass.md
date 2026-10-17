---
id: TASK-468
title: 'SVG: the SMIL animation check reads the attributes it emits (decoy bypass)'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:03'
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
- [x] #1 A decoy attribute, in another case or namespace, can't let an animation of href, xlink:href, on* or style through; every item of `values` is checked
- [x] #2 A property test and a fuzz invariant: no emitted animation targets href, xlink:href, on* or style
- [x] #3 Legitimate fill, opacity and transform animations are still emitted
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-17): unsafe_animation now fails closed. It reads every attributeName/values/from/to/by attribute, in any case and any namespace, both as the file has it and as emitted (after id prefixing), so a decoy cannot vouch for the emitted attribute; every ';' item of a values list is checked. Tests in crates/lumiose_svg/tests/security.rs: Prism's decoy cases (case, namespace, xml:, Values/x:values/TO decoys, a tab inside the scheme), legitimate fill/opacity/transform/visibility animations kept, and a property test (3000 seeded random animations with decoys in any case, namespace and order; both kept and dropped outcomes occur). The invariant lives in tests/support/animations.rs, a parser of the emitted component independent of the sanitizer, shared by the tests and fuzz/fuzz_targets/svg_component.rs, which now panics on an unsafe emitted animation. Both new tests and the fuzz invariant fail on the old emit.rs (decoy replayed through an uninstrumented build of the fuzz target). Limitation: no nightly toolchain here, so no coverage-guided cargo fuzz run; a 60 s uninstrumented libFuzzer run with an SVG dictionary found nothing. svg.md's animation bullet updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The SVG sanitizer decides an animation's safety from every spelling of its attributes (any case, any namespace) and from the emitted view, failing closed; values items are all checked. Property test plus a fuzz invariant (no emitted animation targets href, xlink:href, on* or style, or holds a javascript: value); svg.md updated.
<!-- SECTION:FINAL_SUMMARY:END -->
