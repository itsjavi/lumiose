---
id: TASK-32
title: Write the docs in the package and generate diagnostics docs
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:40'
labels: []
milestone: m-5
dependencies:
  - TASK-9
  - TASK-10
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents and humans need version-matched local docs that follow one pattern, plus generated pages for every diagnostic (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/lumen/docs follows the concept → API → example → common mistakes → diagnostics pattern for every concept in spec §4-§8
- [ ] #2 Diagnostics pages generated from the registry; lumen docs and lumen explain read them; llms.txt and llms-full.txt are generated
- [ ] #3 Docs examples are type-checked in CI
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read spec doc-1 §4-§8, decisions 10-20 and the implemented APIs in packages/lumen/src so the docs match reality (status notes where they do not).
2. Docs in packages/lumen/docs: README index, getting-started, concepts/* (13 pages, concept → API → example → common mistakes → related diagnostics), reference/* (per export, by module).
3. src/cli/docs: docs library (load, resolve, search, printable) + lumen docs [topic] / lumen explain <code> with --format json; generate.ts (registry parser, error pages with generated header + preserved hand-written body, errors index, llms.txt/llms-full.txt).
4. scripts/gen-error-docs.ts and scripts/gen-llms.ts (--check), package scripts docs:gen / docs:check.
5. Tests: CLI behaviour, concept page structure, links resolve, generated files current, no undocumented codes; examples.test.ts type-checks every `check`-marked block via lumen check machinery with a negative control.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover note: executed by Beacon (assignee) as a worker under Lux.

Decisions and deviations:
- Error pages live at docs/errors/LUMxxxx.md (as briefed, and matching LumenError URLs https://lumen.dev/errors/<code>). The registry's DiagnosticInfo::docs() returns diagnostics/<id>; lumen docs accepts both errors/ and diagnostics/ forms plus the bare code. Follow-up filed to align.
- Each error page = generated header (code, title, severity, category from registry.rs, between markers) + hand-written body kept on regeneration; new codes get a stub, and a test fails while any registry code is undocumented (decision-10: docs are release-blocking).
- LUM3014-3016 appeared in registry.rs during this task (Halo/Photon WIP); documented. LUM6001 (tsconfig, emitted by lumen check) is not in the registry: no page; follow-up filed.
- Generated errors/README.md tables are emitted column-aligned exactly as oxfmt prints them, so repo-wide oxfmt keeps them current.
- Docs describe the designed API; pages carry Status notes where this version differs: SPA router (lumen/router exports nothing, navigating() missing), CSS output of style blocks empty until TASK-45, island hydration (TASK-18), lumen dev/build/prerender/staticPaths (TASK-24/26), @lumen/testing, create-lumen, lumen mcp. Error pages say who reports each code (compiler, CSS compiler, runtime, route scanner, or planned: 2007, 3008, 4004, 4006, 4008, 5001).
- Found: under Vitest (DOM env) `lumen` resolves to its node entry (signals are plain cells), so components never update; resolve.conditions: ["browser"] fixes it (verified in examples/vite-counter with a throwaway test). Documented in concepts/testing; follow-up filed for the Vite plugin.
- main.ts is concurrently edited by Nova (TASK-24 adds dev); my changes are limited to the docs/explain dispatch and flag validation.
<!-- SECTION:NOTES:END -->
