---
id: TASK-97
title: Keep SVG component root attributes in the template
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 21:46'
updated_date: '2026-10-08 22:20'
labels: []
milestone: m-3
dependencies:
  - TASK-70
priority: low
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Halo noticed (TASK-70) that every SVG icon component sets its root attributes at runtime because of how props are spread, instead of keeping the file's static attributes in the template.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Static root attributes of compiled SVG components stay in the template HTML; only props that are actually passed are applied at runtime; goldens and size check
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Compiler-side (no lumen_svg change: the generated component is <svg …file attributes… role/aria getters {...rest}>). element.rs bake_before_spreads: when every spread of an intrinsic element is the component's props object or its destructured ...rest (fixed keys for the component's lifetime; ComponentCtx.props_objects), constant attributes written before the first spread go into the template; a passed prop still overrides them through the spread, and an absent key never appears later, so the result equals the merged props. class, style, DOM properties, events, helpers, namespaced names and anything after the spread stay in the spread, as does everything when a spread may change its keys (other objects). Server output unchanged: spreadAttrs(mergeProps(defaults, rest)) is what deduplicates overridden attributes in the HTML string.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: done. Evidence: golden crates/lumen_compiler/tests/fixtures/client/spread-defaults.{tsx,js,server.js} (Icon: template `<svg viewBox="0 0 24 24" fill=none focusable>`, spread only the aria-label getter and rest; Field with {...props}: type baked, class/style/value and data-after stay; Dynamic {...attrs()}: nothing baked). compileSvg of a 5-attribute icon: client template `<svg viewBox="0 0 24 24" width=24 height=24 fill=none stroke=currentColor>`, mergeProps keeps only role/aria-labelledby/aria-hidden + rest, so a render sets 3 attributes plus the passed props instead of 8. Size check: compiled icon module 1063 → 1035 B raw, 493 → 494 B brotli (unchanged; the win is runtime DOM writes). svg.dom.test.ts (client override of width, server/client markup parity, hydration) green; pnpm test 1025/1025; cargo test/clippy/fmt -p lumen_compiler. Docs: concepts/svg.md notes the defaults stay in the template.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Constant attributes written before a spread of the component's props object or ...rest now stay in the client template, so compiled .svg components clone their root attributes and the runtime spread only sets the props actually passed (plus title/aria getters). Server output is unchanged (it merges defaults and props into one attribute string). Golden spread-defaults; svg.md updated.
<!-- SECTION:FINAL_SUMMARY:END -->
