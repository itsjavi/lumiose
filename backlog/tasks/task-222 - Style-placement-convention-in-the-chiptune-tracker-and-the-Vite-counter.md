---
id: TASK-222
title: Style placement convention in the chiptune tracker and the Vite counter
status: Done
assignee:
  - Spark
created_date: '2026-10-11 01:24'
updated_date: '2026-10-11 01:43'
labels:
  - styles
  - example
milestone: m-6
dependencies: []
priority: medium
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-40 (user 2026-10-11): teach and use one top-level <style> at the end of the file by default, shared by every component in it; nested blocks only to scope one element's subtree or to read a component-local $constant. The docs show and explain both placements. Apply it to examples/spa-chiptune (16 files with <style>, 12 nested) and examples/vite-counter (3 files). The chiptune tracker's prerender work (TASK-217) touches the same files: do this first, or in the same session.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each .stsx file uses one top-level <style> at the end of the file by default; every remaining nested block scopes an element subtree or reads a component-local constant
- [x] #2 Rendering is unchanged: tests and e2e pass, and before/after screenshots of the main pages match (watch for selectors that now reach other components in the same file)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): moved every nested block to one file-level <style> at the end of the file. Chiptune: 12 files (ChannelHeader, Header [SongNumber+Header merged], InstrumentList, InstrumentView, MacroEditor, Meters [Vu+Scope merged], OrderList, SettingsView, SongsView, StatusBar, TrackerView, routes/_404); Mixer, PatternEditor, PixelLogo and _layout already used file-level blocks. Vite counter: App (nested block merged into its file block), Counter, Todos. No nested block remains: each was directly under the component root and read only imported $tokens/$theme, so none needs a component-local constant or subtree scope. Multi-component files checked for widened selectors: Header's rules never match SongNumber's label/input and SongNumber's input rule has no input in Header; Vu and Scope classes do not overlap.
Evidence: computed styles of every element (all properties, plus ::before/::after content) dumped before/after on /, /songs, /instruments, /settings, a 404 (chiptune, lumiose preview) and / (vite-counter, vite preview): 0 differences across 2,912 elements. Screenshots identical except clock/FPS text. Checks: lumiose check (both), chiptune vitest 10/10, chiptune playwright 20/20 (the dev 'mutes and solos' test failed once under machine load, then passed 3/3 with --repeat-each), pages config 2/2, vite-counter playwright 10 passed/4 skipped (the HMR test's search string updated for the new indentation), lumiose build and vite build OK, oxfmt clean. README UI row updated.
Screenshots: backlog/assets/task-222-chiptune-tracker.png, backlog/assets/task-222-chiptune-instruments.png, backlog/assets/task-222-vite-counter.png
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Chiptune tracker (12 files) and Vite counter (3 files) follow decision-40: one file-level <style> at the end of each file, no nested blocks left (none scoped a subtree or read a component-local constant). Rendering verified unchanged by a full computed-style diff (0 differences) and screenshots; unit, e2e and builds green.
<!-- SECTION:FINAL_SUMMARY:END -->
