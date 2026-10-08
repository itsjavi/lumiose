---
id: TASK-53
title: Register LUM6001 and align diagnostic docs topics
status: To Do
assignee:
  - Photon
created_date: '2026-10-08 15:40'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while writing the docs (TASK-32). (1) LUM6001 (tsconfig missing options required by Lumen, spec §5.4 6xxx) is emitted by lumen check (packages/lumen/src/cli/check/tsconfig.ts, provisional) but is not in crates/lumen_compiler/src/diagnostics/registry.rs, so it has no generated page and lumen explain LUM6001 fails. (2) DiagnosticInfo::docs() returns diagnostics/<id>, while the generated pages live at packages/lumen/docs/errors/<id>.md and LumenError links https://lumen.dev/errors/<code>. lumen docs accepts both forms today, but the docs field should name the real topic. After changing the registry run pnpm --filter lumen docs:gen and fill the new page's explanation (the docs test fails while a code is undocumented).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LUM6001 is registered (6xxx tooling range) and docs/errors/LUM6001.md is written
- [ ] #2 DiagnosticInfo::docs() returns errors/<id>, matching the docs path and LumenError URLs
<!-- AC:END -->
