---
id: TASK-211
title: 'Landing: live editable .stsx demo island'
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 03:01'
labels:
  - landing
  - positioning
milestone: m-7
dependencies: []
priority: medium
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the 'Familiar to write' section shows code as an editable island built on the playground's WASM compiler and preview runtime. Edit a .stsx sample, see the JS output, the CSS output and the rendered result update. None of the eight competitor landing pages lets visitors edit code. The WASM loads only when the island becomes visible, so the landing's initial payload stays light.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Edits compile in the browser and update the JS output, CSS output and preview
- [x] #2 The compiler and WASM load only when the island is visible; the landing's initial JS is unchanged
- [x] #3 Without JavaScript the section still shows the sample and its output as static tabs; an e2e test covers editing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon:
- The landing's 'TSX and CSS, compiled together' sample is now <Playground client:visible embedded code={counterSource}> (the TASK-214 island). The sample (content/samples.ts) is Counter + Reset sharing one file-level <style> (decision-40), with $gap, $radius.pill and calc(); default export so the preview mounts it.
- Playground gains a children slot: a static stand-in shown until the compiler is ready, and all a visitor without JavaScript sees. Rendered unconditionally and hidden once live (no slot behind a condition). Embedded layout: editor above output, fixed heights.
- Stand-in: StaticTabs in routes/index.stsx, radio buttons + CSS :has(:checked), no JS: You write / JS output / CSS output. The outputs are exactly what the playground's first compile shows (/src/App.stsx, root /, client target); content.test.ts compiles the sample the same way and checks them.
- Loading: the island module, CodeMirror and the WASM compiler load only when the demo scrolls into view (client:visible + onMount). Initial JS, same tree, before vs after (index.html-referenced scripts): 34612 vs 34610 bytes raw, 12423 vs 12398 brotli, same files (loader, SiteNav, ThemeToggle, src); at 1280x720 the requests on load are the same 5 files. e2e asserts no Playground/codemirror/wasm request before scrolling.
- a11y: the CodeMirror editor now shows the site focus ring when focused (2.4.7; also on /playground). The axe suite covers the landing with the demo live and with its static stand-in, both themes.
- Tests: playground.e2e.ts 'the landing's live demo loads when visible, and edits update the outputs' (edit text + constant, preview/Client JS/CSS update) and 'without JavaScript … shows the sample and its output as tabs'.
- Screenshots: backlog/assets/task-211-live-light.png, task-211-live-dark.png, task-211-static.png.
- Checks: apps/web e2e 55/55, vitest 18/18, lumiose check clean, oxlint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The landing's code sample is a live, editable .stsx demo (the playground island, embedded): edits update the preview, client JS and CSS; it loads only when visible with no initial-JS growth; without JS it shows the sample and its outputs as CSS-only tabs. e2e covers editing and the no-JS view; axe passes.
<!-- SECTION:FINAL_SUMMARY:END -->
