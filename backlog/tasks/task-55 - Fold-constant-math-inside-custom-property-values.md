---
id: TASK-55
title: Fold constant math inside custom property values
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 15:50'
updated_date: '2026-10-08 15:58'
labels: []
milestone: m-1
dependencies:
  - TASK-10
priority: low
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lightning CSS already reduces calc(), min(), max(), clamp() and similar expressions with concrete compatible values in regular properties (verified: calc(8 * 2px) becomes 16px, min(10px, 20px) becomes 10px, rotate(calc(45deg * 2)) becomes rotate(90deg)). Since $refs are substituted before parsing, $name math is precomputed by default with no attribute needed. Custom property values are kept as unparsed tokens, so --x: calc($gap * 2px) stays as calc(8 * 2px).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen_css folds math functions in custom property values when every operand is a concrete value with compatible units (e.g. --x: calc(8 * 2px) becomes 16px); values with var(), mixed or relative-to-context units (%, vw, em, rem with px) are left untouched
- [x] #2 Fixtures cover regular properties (documenting Lightning CSS behaviour) and custom properties; no change to semantics
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New crates/lumen_css/src/fold.rs, called from the AST rewrite pass (ast.rs visit_property) for Property::Custom with a --dashed name.
2. Walk the custom property TokenList; for each math function (calc/min/max/clamp/round/mod/rem/abs/sign/trig/pow/sqrt/hypot/log/exp) print it back and parse it with Lightning CSS's Calc<V> for V = number, Length, Percentage, Angle, Time; replace only when it reduces to one finite value. Recurse into non-math functions and var() fallbacks.
3. Keep calc() around results whose bare form could differ at the unknown use site (negative, fractional number, non-separator neighbour token).
4. Golden fixture tests/fixtures/math.stsx covering regular properties (Lightning behaviour) and custom properties, positive and negative cases; cargo test/clippy/fmt.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (standalone worker under Lux): implemented crates/lumen_css/src/fold.rs + 3-line hook in ast.rs, crate docs bullet in lib.rs, fixture tests/fixtures/math.{stsx,out}. No public API change.
Decisions: parse Calc<V> directly, not V::parse (Percentage::parse has an unreachable!() on non-reducing calc). Numbers win first; a typed expression reducing to a number (sign(-2px)) folds to a number. Partly reducible functions (calc(100% - min(4px, 8px))) are kept whole, per task. -0 normalised to 0. Unknown (non --) properties untouched.
Semantics guard: result written bare only when >= 0, integral if a plain number, and both neighbours are whitespace/comma/list edge; otherwise calc(<value>) (e.g. --negative: calc(-5px), --ratio: calc(.333333), calc(2px*2)calc(1px) -> calc(4px)calc(1px)) so clamping, integer rounding and tokenisation stay identical.
Finding (Lightning CSS, regular properties, out of scope): padding-left: calc(2px - 7px) is folded to -5px and merged into padding: 16px 16px 16px -5px, which browsers drop entirely (calc would clamp to 0). Documented in math.out.
Follow-up idea: the same fold could apply to Property::Unparsed values (regular properties containing var(), e.g. max-width: calc(var(--w) + 8 * 2px) or padding: var(--x) calc($gap * 2px)), which Lightning CSS leaves unfolded.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen_css now folds constant math inside custom property values (new src/fold.rs, hooked into the AST pass). Each math function is printed back and parsed with Lightning CSS's Calc<V> for number/length/percentage/angle/time; one finite value replaces it (--x: calc(8 * 2px) -> 16px, --abs: calc(1in + 4px) -> 100px, --angle: rotate(calc(45deg * 2)) -> rotate(90deg), var() fallbacks too). var()/env(), mixed or runtime-relative units (calc(100% - 16px), calc(1em + 2px), min(10vw, 100px)), division by zero, infinity and partial reductions are left untouched. Results that could behave differently bare stay in calc() (negatives, fractional numbers, tokens glued to neighbours). Fixture tests/fixtures/math.stsx/.out documents Lightning CSS behaviour for regular properties (incl. the negative padding fold) and covers custom-property positive/negative cases and every supported math function. Validation: cargo test -p lumen_css (19 unit + fixtures) pass; cargo clippy -p lumen_css --all-targets -D warnings clean; cargo fmt applied. No public API change.
<!-- SECTION:FINAL_SUMMARY:END -->
