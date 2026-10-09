---
id: TASK-122
title: Diagnostics polish and agent-DX fixes from the DX review
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:43'
labels:
  - tooling
  - docs
dependencies: []
priority: low
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 findings 9, 10, 16, 17 (except create-lumen --mcp, a pending user proposal): suppress TS errors inside LUM1006 spans; note hidden semantic errors while syntax errors exist; strip stacks after LUMxxxx build errors (small vite/ edit approved); replace lumen.dev/errors links with the lumen docs hint until the site exists; declare *.css in lumen/env; lumen docs/docs_get with an exact export name prints its reference section; MCP render gets a stripped mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each listed item fixed with tests where testable; docs updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): all items done (create-lumen --mcp excluded, now TASK-131). (1) lumen check drops TS diagnostics inside a LUM1006 raw-CSS block (<style ... </style>), the LSP filters them with the scanner's blocks for .tsx. (2) lumen check notes hidden type errors when TS reports only TS1xxx syntax errors (human 'note:' after the summary, JSON/MCP 'notes'). (3) LUMxxxx build errors from lumen/vite carry no stack (LumenError with empty stack: rolldown printed the plugin's internals after the frame); lumen build output is now message + frame; plain 'vite build' still prints the aggregate's own stack (Vite CLI). Small edit in vite/index.ts (approved), coordinated with Photon's TASK-109 edits in the same file. (4) LumenError (app/diagnostics.ts, Nova's area) and the LUM4006 hydration warnings (dom/hydrate.ts, Spark's area) say 'run `lumen docs CODE`' instead of lumen.dev links; registry.rs doc comment (Photon) and apps/web errors route comment left. (5) lumen/env declares *.css (+ ?url/?inline/?raw) in src/jsx/css-modules.d.ts: TS 7 checks side-effect imports (TS2882). Found: svg-modules.d.ts conflicts with vite/client ('Duplicate identifier src') when both are loaded, pre-existing (Halo). (6) lumen docs / docs_get with an exact export name (case-sensitive, documented by one reference page) prints that reference section. (7) MCP render strip: true returns the visible markup (no script/style/link/meta/template, comments, data-l-*). Docs: reference/cli, jsx, mcp. Tests: check.test (raw CSS, notes, formatHuman), LSP raw-CSS test, docs.test export lookup, mcp.test strip, jsx-types consumer CSS import.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Diagnostics polish: TS noise in LUM1006 blocks dropped (check + LSP), syntax-error note, stackless LUMxxxx build errors, lumen docs hints instead of lumen.dev links, *.css in lumen/env, export-name docs lookups, MCP render strip mode.
<!-- SECTION:FINAL_SUMMARY:END -->
