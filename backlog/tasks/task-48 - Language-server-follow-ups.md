---
id: TASK-48
title: Language server follow-ups
status: To Do
assignee:
  - Beacon
created_date: '2026-10-08 14:03'
labels:
  - tooling
dependencies:
  - TASK-29
priority: low
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Gaps found while implementing TASK-29 (packages/language-server). (1) Import syncShadows/shadowPathFor from a lumen package export (e.g. lumen/check; packages/lumen/package.json is Lux-owned) instead of the relative import in packages/language-server/src/shadows.ts. (2) Wire the compiler's compile() diagnostics (once @lumen/compiler exposes it) through ServerOptions.diagnosticProviders in src/bin.ts. (3) Restart the TS 7 LSP after a crash (today: error message, CSS/Lumen features keep working). (4) Cross-file class features: offer/define classes from <style global> blocks of other files (e.g. root _layout.stsx). (5) Merge CSS document symbols into TS symbols for .stsx; execution-contract hovers (spec §9.2). (6) Optionally filter TS window/logMessage verbosity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Language server imports the shadow API from a lumen package export
- [ ] #2 Compiler diagnostics flow into .stsx diagnostics with a protocol test
- [ ] #3 TS LSP crash recovery covered by a test
<!-- AC:END -->
