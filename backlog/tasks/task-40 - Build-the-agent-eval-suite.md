---
id: TASK-40
title: Build the agent eval suite
status: Done
assignee:
  - Quasar
created_date: '2026-10-08 12:21'
updated_date: '2026-10-10 02:29'
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

Quasar RESUME (2026-10-09 15:51 UTC, paused for Claude quota ~87%): matrix (option C: 20 tasks × 1 run × 6 configs, all medium, baseline, Lumen pinned at ed72928) is at 62/120 runs, all 62 passed. Done for all six configs: about-page, blog-tags, class-passthrough, contact-form, counter-island, custom-404, fix-browser-api-module-scope, fix-island-function-prop, fix-list-mutation, fix-reactive-early-return; fix-server-import-in-island done for Opus and Sonnet only. Results: evals/results/2026-10-09T151008-macbookpro.json (meta.complete=false, notes explain the pin, the discarded high-effort luna/haiku runs and the pause). Remaining 58 runs, exact command (skips done pairs, appends to the same file): cd evals && LUMEN_EVAL_REV=ed7292832908857eed3fb57b126eeb6a7d3fd913 node src/cli.ts run --agents claude:claude-opus-5-5:medium,claude:claude-sonnet-5-5:medium,codex:gpt-6-astra:medium,codex:gpt-6.1-sol:medium,codex:gpt-6-luna:medium,claude:claude-haiku-5-5:medium --runs 1 --ablations baseline --keep --resume 2026-10-09T151008-macbookpro.json  (Claude share of the remaining runs: 29). Then write the summary (pass rate per model and category, median time, cost/tokens, failures classified) and report to Lux. Kept projects/transcripts in evals/.runs/2026-10-09T151008 (git-ignored).

Quasar 2026-10-09 16:30 UTC — option C matrix summary (20 tasks × 1 run × 6 configs, all medium, baseline, Lumen ed72928; results evals/results/2026-10-09T151008-macbookpro.json).
- Valid runs 116/120, all 116 PASS. 4 Claude runs could not start (Claude session limit, resets 20:40 Europe/Berlin): styled-badge/haiku, todo-named-actions/opus, sonnet, haiku. Not recorded; finish with the RESUME command above (same --resume file) after the reset. The runner now stops on a quota error instead of recording it (exit 3).
- Per model (pass, median wall time [max], median turns / tool calls, median output tokens, median input tokens incl. cache, cost): Opus 19/19, 27 s [47], 6/5, 1.8k, 226k, $0.23/run ($4.83 total, list price); Sonnet 19/19, 17 s [30], 5/4, 1.1k, 145k, $0.10/run ($1.97); Haiku 18/18, 31 s [67], 11/9, 3.3k, 334k, $0.01/run ($0.19); gpt-6-astra 20/20, 34 s [68], 9.5/8, 0.8k, 120k; gpt-6.1-sol 20/20, 38 s [121], 11/9.5, 0.8k, 124k; gpt-6-luna 20/20, 16 s [30], 7/5, 0.7k, 101k. Codex reports no cost. Wall times are indicative (other agents active).
- Per category: scaffold 6/6, routing 30/30, styles 23/23, islands 30/30, actions 9/9, reactivity 18/18 (median 21–45 s; actions slowest).
- Failures: none by model, none by task/fixture, none by Lumen DX. Every run ran lumen check; the first check failed in 7 runs (fix-island-function-prop ×3, where the starting code has the error, so that is diagnosis; plus fix-stale-total/sonnet, like-button-island/sonnet, progress-runtime-style/haiku, scaffold-from-scratch/opus), all fixed before finishing. Haiku loaded the project's lumen skill in 16/18 runs, Opus/Sonnet in 2; Codex models read llms.txt more (1.0–1.6 per run) than Claude (0–0.5).
- Assessment: ceiling effect — this suite does not separate the models yet. Next (needs Lux): harder tasks (multi-file features, SPA router, Suspense/streaming, middleware/cookies, CSP, debugging from failing tests) and the ablations, where the differences should show.

Quasar 2026-10-09 18:58 UTC — matrix complete: the 4 Claude runs blocked by the session limit were run after the reset (--resume, same pin ed72928); all 4 passed. Final: 120/120 PASS (meta.complete=true). Updated Claude figures: Opus 20/20, median 27 s [47], $0.25/run median, $5.32 total (list price); Sonnet 20/20, 17 s [30], $0.10/run, $2.17 total; Haiku 20/20, 35 s [72], $0.011/run, $0.23 total. Codex figures unchanged (astra 20/20 34 s; sol 20/20 38 s; luna 20/20 16 s). Categories: scaffold 6/6, routing 30/30, styles 24/24, islands 30/30, actions 12/12, reactivity 18/18. No model, task/fixture or Lumen DX failures. Next step (harder tasks, ablations) awaits Lux/user.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Eval suite (doc-5): 20 validated tasks, runner over local claude -p / codex exec, viewer. Option C: 120/120 passed across 6 models at medium. Harder tasks and ablations: TASK-185 (pending the user's go-ahead).
<!-- SECTION:FINAL_SUMMARY:END -->
