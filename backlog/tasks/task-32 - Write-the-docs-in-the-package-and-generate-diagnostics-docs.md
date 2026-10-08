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
