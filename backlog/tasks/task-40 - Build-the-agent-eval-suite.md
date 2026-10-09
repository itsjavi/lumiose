---
id: TASK-40
title: Build the agent eval suite
status: In Progress
assignee:
  - Quasar
created_date: '2026-10-08 12:21'
updated_date: '2026-10-09 14:58'
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
- [x] #1 A set of eval tasks (scaffold, styled component, island, route with action, fix a reactivity bug) and a runner recording first-attempt lumen check pass rate, success and tokens
- [x] #2 Smoke run (5 tasks x 1 run x 4 models) committed with results and per-run quota/time cost reported to Lux
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09 (user-approved design): ~20 tasks = fixture project + prompt + hidden acceptance tests; runner drives local agent CLIs on the user's machine (their quota, no API): claude -p (Claude Code) and codex exec (Codex), models and reasoning effort configurable per run (max high). Initial matrix: Codex gpt-6 astra (medium), gpt-6.1 sol (medium), Claude Opus 5.5 (medium), Claude Sonnet 5.5 (medium); later gpt-6 luna and Claude Haiku 5.5. Verify exact model ids with each CLI. Isolated temp copy per run with an offline pnpm store, sandboxed permissions, time/turn budgets. Grading by hidden tests only; record turns, tokens if reported, wall time, lumen check errors, docs/MCP usage. Ablations: with/without MCP, AGENTS.md, llms.txt. JSON results + a viewer (reuse the bench viewer). Start with a 5-task x 1-run smoke to measure quota cost before full runs.

Quasar (quasar-20261009T121332Z) started.

Quasar RESUME (2026-10-09, session checkpoint): evals/ committed (package @lumen/evals, added to pnpm-workspace). Done: runner (src/cli.ts run|validate|--list), isolated projects in $TMPDIR/lumen-evals (create-lumen template + task start/, read-only vendor snapshot of lumen/adapter-node/compiler linked via link:, shared lockfile, pnpm install --offline), agent adapters (src/agents.ts: claude -p with --setting-sources project,local --strict-mcp-config, acceptEdits + sandboxed Bash, no web, --max-turns; codex exec with private CODEX_HOME (auth.json symlink), workspace-write, no network, approval never; model + effort low|medium|high), grading by hidden vitest tests + lumen check (src/grade.ts, grader/helpers.ts), metrics (turns, steps, tokens, Claude list-price cost, check runs/first-check-ok, LUM codes from checks/builds, docs/llms/MCP/skill usage), results JSON (results/ + index.json, rewritten after every run). Verified model ids: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5; codex gpt-6-astra, gpt-6.1-sol, gpt-6-luna. Two pipeline test runs only (haiku low and luna low on about-page, ~30 s, Claude $0.01 list); results discarded. Tasks so far (7, all validated: hidden tests fail on start/, pass on solution/): about-page, styled-badge, counter-island, contact-form, fix-stale-total, blog-tags, json-endpoint. NEXT: 13 more tasks (planned: custom-404, ssr-search, scaffold-from-scratch, scope-leak, progress-runtime-style, class-passthrough, like-button-island, fix-island-function-prop (LUM4002), fix-server-import-in-island (LUM4003), fix-browser-api-module-scope (LUM4004), todo-named-actions, fix-list-mutation, fix-reactive-early-return (LUM2003)); viewer (evals/viewer, adapted from the bench viewer); doc page for the suite; then the 5-task x 1-run smoke (smoke tasks: about-page, styled-badge, counter-island, contact-form, fix-stale-total) and report time/quota to Lux before any matrix. No agent runs started beyond the two pipeline tests.

Quasar 2026-10-09 (resumed): 20 tasks, all validated against the committed revision (hidden tests fail on start/, pass on solution/). Viewer (evals/viewer, pnpm --filter @lumen/evals run view) and doc-5 (spec). Fix found by the smoke: the vendor snapshot copied the working tree, which held other agents' unfinished component-HMR code (dom/hot.ts) and broke DOM tests in 8 runs; it now comes from git archive of the pinned revision with the napi binding built from it (cargo, ~2 min first time per revision). Smoke (5 tasks x 1 run x 4 medium models, baseline): 20/20 pass; affected 8 runs repeated; merged into results/2026-10-09T143057-macbookpro.json with notes. Per run: Opus median 27 s, $0.30 list (sum $1.46/5); Sonnet 18 s, $0.13 ($0.59/5); gpt-6-astra 34 s; gpt-6.1-sol 48 s (max 124 s); Codex reports tokens only (median in 87k/114k incl. cache, out ~800). Runner overhead ~10-20 s per run (project + grading). Finding for Lux: LUM4004 (browser API at module scope) is registered and documented but never emitted by the compiler or lumen check (localStorage at module scope passes check, crashes SSR). Waiting for Lux's go-ahead before any larger matrix.

Smoke screenshot: backlog/assets/task-40-evals-viewer.png. Task stays In Progress until Lux decides the next matrix.
<!-- SECTION:NOTES:END -->
