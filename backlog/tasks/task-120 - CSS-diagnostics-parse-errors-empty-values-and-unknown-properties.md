---
id: TASK-120
title: 'CSS diagnostics: parse errors, empty values and unknown properties'
status: Done
assignee:
  - Halo
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:30'
labels:
  - css
  - diagnostics
dependencies: []
priority: medium
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 6. In <style>, colr: red, color: ; and an unclosed { produce no diagnostic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Lightning CSS parse/recovery warnings surface as LUM diagnostics with locations; unknown properties warn (vendor-prefixed and --* allowed)
- [x] #2 Tests and errors/<id> docs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-09): Lightning CSS parse errors (LUM3014) and recovery warnings (LUM3015) were already surfaced with locations; the three reported cases produced no Lightning warning at all, so lumen_css checks them on the prepass declarations: unknown property names -> new LUM3020 warning (known = MDN's list from mdn-data 2.27.1, 551 names, src/known_properties.rs, or Lightning's PropertyId; --*, vendor-prefixed, descriptors and non-identifier names skipped; did-you-mean help + fix within 1-2 edits); empty values (incl. only !important/comments; not custom properties) -> LUM3017; an unclosed { -> LUM3014 error at the brace with the rule prelude as label. Registered LUM3020 in lumen_compiler's registry (Photon's file, 2 lines). All repo .stsx files scanned: only test fixtures report. Docs: errors/LUM3020 (new), LUM3017, LUM3014, concepts/styles. Edited Beacon's packages/language-server/src/server.test.ts expectations (LS shows LUM3017 next to the CSS service's duplicate); dedupe recorded as TASK-132 (Beacon). Validation: cargo test lumen_css/lumen_compiler/lumen_content, clippy, fmt, vitest (lumen cli/vite, language-server, compiler): green except the unrelated LS hover test 'describes Lumen attributes and <style> tags' (on:click hover text). pnpm build:compiler currently fails on Photon's in-progress crates/lumen_compiler/src/imports.rs; the binary used for the JS tests was built before that, with these changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In <style>, unknown properties now warn (LUM3020, with a typo fix), empty values warn (LUM3017) and an unclosed { is an error (LUM3014), all with exact locations; Lightning CSS's own parse errors and recovery warnings were already LUM3014/LUM3015. Docs: errors/LUM3020 and updates to LUM3014, LUM3017 and concepts/styles.
<!-- SECTION:FINAL_SUMMARY:END -->
