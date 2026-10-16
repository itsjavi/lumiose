---
id: TASK-395
title: 'Tabs: Indicator part'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-16 02:12'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-359
priority: low
ordinal: 394000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Halo in TASK-359 (2026-10-15): Base UI's Tabs.Indicator highlights the selected tab. With CSS anchor positioning it could need no script; check doc-9 section 8 (an indicator positioned before hydration).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tabs.Indicator follows the selected tab without a layout shift on load
- [x] #2 Docs page and e2e updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): Tabs.Indicator renders `<span aria-hidden=true data-indicator>` inside Tabs.List (hidden while no tab can be selected). Placement without script: Root writes `--lu-tabs-anchor: --lu-tabs-<id>` in its style, tabs.css gives the selected tab that anchor-name and positions the indicator with anchor()/anchor-size() under @supports, so it is in place at first paint (doc-9 §8). Once the script runs it writes the selected tab's box (from the list's padding edge) on the Root as --lu-tabs-indicator-{left,top,width,height}, which override the anchor values so a theme can transition them, and place it without anchor positioning. Kept current on selection (script, keys, an island re-rendering aria-selected via a MutationObserver), resize (ResizeObserver on list and tabs) and any `dir` attribute change (one shared observer; found by the RTL screenshot). The indicator sits behind the tabs' text (list isolation, z-index -1); the tabs are position: relative so axe 4.13's stacking order agrees (it put a z-index -1 element on top and reported color-contrast as needs-review). Theme: the indicator draws the 2px bar (inline-end when vertical), the tab's own bar goes once `:defined`, 0.2s slide unless reduced motion. E2E: placed by CSS without JS, no layout-shift entries on load, follows click/keys/text resize in both orientations, follows an island's selection, RTL. Script 1.18 kB brotli (was 0.8), tabs.css 0.27 kB. Proposed names: Tabs.Indicator, TabsIndicatorProps, --lu-tabs-anchor, --lu-tabs-indicator-{left,top,width,height}, data-indicator.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tabs.Indicator: placed over the selected tab by CSS anchor positioning from the server HTML (no layout shift on load), then measured by <lu-tabs>' script into --lu-tabs-indicator-* variables so it slides between tabs, follows islands, resizes and dir changes. Default theme draws the bar with it. Docs (tabs.md Indicator section, example, styling, browser support) and e2e (no-JS placement, no layout shift, follow, island, RTL). Screenshots: backlog/assets/task-395-tabs-indicator.png, task-395-tabs-indicator-rtl.png.
<!-- SECTION:FINAL_SUMMARY:END -->
