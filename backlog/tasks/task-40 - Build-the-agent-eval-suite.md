---
id: TASK-40
title: Build the agent eval suite
status: To Do
assignee:
  - Quasar
created_date: '2026-10-08 12:21'
updated_date: '2026-10-09 12:12'
labels: []
milestone: m-7
dependencies:
  - TASK-33
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: low
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agent-first DX must be measured: real coding agents complete fixed tasks and regressions block releases (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A set of eval tasks (scaffold, styled component, island, route with action, fix a reactivity bug) and a runner recording first-attempt lumen check pass rate, success and tokens
- [ ] #2 Smoke run (5 tasks x 1 run x 4 models) committed with results and per-run quota/time cost reported to Lux
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09 (user-approved design): ~20 tasks = fixture project + prompt + hidden acceptance tests; runner drives local agent CLIs on the user's machine (their quota, no API): claude -p (Claude Code) and codex exec (Codex), models and reasoning effort configurable per run (max high). Initial matrix: Codex gpt-6 astra (medium), gpt-6.1 sol (medium), Claude Opus 5.5 (medium), Claude Sonnet 5.5 (medium); later gpt-6 luna and Claude Haiku 5.5. Verify exact model ids with each CLI. Isolated temp copy per run with an offline pnpm store, sandboxed permissions, time/turn budgets. Grading by hidden tests only; record turns, tokens if reported, wall time, lumen check errors, docs/MCP usage. Ablations: with/without MCP, AGENTS.md, llms.txt. JSON results + a viewer (reuse the bench viewer). Start with a 5-task x 1-run smoke to measure quota cost before full runs.
<!-- SECTION:NOTES:END -->
