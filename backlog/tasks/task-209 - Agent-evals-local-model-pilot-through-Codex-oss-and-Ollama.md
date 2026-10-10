---
id: TASK-209
title: 'Agent evals: local-model pilot through Codex --oss and Ollama'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
labels:
  - evals
milestone: m-5
dependencies: []
priority: low
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/), user 2026-10-11: pilot qwen3.5:9b and gpt-oss:20b (both already pulled in Ollama 0.35.1) on 3 tasks, 1 run each, before deciding a full local matrix. Codex runs them with `codex exec --oss --local-provider ollama -m <model>`, keeping the existing sandbox and grading. Known needs: an agent kind for local models in evals/src/agents.ts (parseAgent splits on ":", which model ids like qwen3.5:9b contain); Ollama served with OLLAMA_CONTEXT_LENGTH of at least 32768, since a small default context truncates silently; a longer wall budget (about 30 minutes); effort recorded as n/a. Results are reported separately from the frontier matrix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The harness runs local models through Codex --oss with Ollama, and the effective context length is verified in the run log
- [ ] #2 Pilot results (pass, wall time, turns, failure modes) for both models are recorded in doc-5, separate from the frontier matrix
- [ ] #3 A recommendation for a full local matrix (tasks, runs, budget) is recorded for the user
<!-- AC:END -->
