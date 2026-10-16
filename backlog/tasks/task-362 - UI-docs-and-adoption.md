---
id: TASK-362
title: UI docs and adoption
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-16 03:36'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-355
  - TASK-357
  - TASK-358
priority: medium
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike (removed in TASK-363; it remains in the git history), proposal and measurements in TASK-332's notes). A docs page per component (parts, props, events, styling hooks, keyboard contract), written with Beacon, and @lumiose/site-kit and apps/web adopting the widgets where they hand-roll them today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every shipped component has a docs page with a type-checked example
- [x] #2 site-kit and apps/web use the widgets
- [x] #3 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [x] #4 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [x] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15: the per-component docs are published in the site's UI section (TASK-387), which the user asked for as the @lumiose/ui docs.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): adoption in 99443055. Survey (Explore agent) of every hand-rolled widget in packages/site-kit and apps/web; no dialogs, menus, popovers or switches are hand-rolled.

Adopted:
- **Playground output tabs** (apps/web/src/islands/Playground.stsx) are @lumiose/ui's Tabs (Root, List, Tab, Panel; activateOnFocus, value/onValueChange driving `selectTab`), replacing hand-written arrow keys and ids. Styles are as before: a `class` on Tabs.Tab carries the file's scope token (class passthrough). playground.e2e finds panels by role and name now.
- **site-kit Tabs** is the site's look over ui's parts (`Tabs.Root/List/Tab/Panel`, automatic activation by default), replacing its hand-written keys and the effect that wired the panels. The showcase and its test are updated, and its screenshot is unchanged.
- **site-kit ThemeToggle** is a ui Toggle (`pressed`/`onPressedChange`).
- site-kit depends on @lumiose/ui (workspace; site-kit is private), under deps.lock.

Kept, with the reason:
- **SiteNav's mobile menu.** The same list is the desktop links and the mobile panel. No ui part is both an inline list and a light-dismiss disclosure, and Popover's dialog role would misname the desktop links.
- **The docs shell's `<details>`** (sidebar menu, Diagnostics group). They are already the native element Collapsible renders, and switching adds its 0.7 kB script to every docs page for animation hooks the site does not use.
- **`title` tooltips on ThemeToggle and CopyButton.** A ui Tooltip in the header island would add 1.5 kB to every page, and both buttons have accessible names. Proposal for the user: replace them if visible tooltips on focus are wanted.
- **The home page's StaticTabs.** Radio inputs switch the panels without JavaScript, which ui Tabs (server state, script keys) cannot do.
- **LightField's play/pause button.** A label that changes is the right pattern there; a Toggle would read "Pause animation, pressed".
- **The Playground's sample `<select>`.** It is already native and accessible.
- **DocsSearch** (a hand-written combobox). Its results are navigation links with the site's own ranking and descriptions, not text values for Autocomplete to fill in. Follow-up proposed (TASK-421).

Checks: apps/web 179 passed, the site-kit showcase 14 passed (8 skipped), and pnpm check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The sites use @lumiose/ui's Tabs (Playground, site-kit) and Toggle (ThemeToggle); the other hand-rolled parts are kept with recorded reasons, DocsSearch as a follow-up (TASK-421) (99443055). Checks: pnpm check (2372 tests), pack:check --smoke --skip-npm (@lumiose/ui 146 files), ui-e2e Chromium 728 passed (22 skipped), Linux Firefox and WebKit 729 passed (21 skipped), apps/web 179 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
