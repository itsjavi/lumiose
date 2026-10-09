---
id: doc-5
title: Agent eval suite
type: specification
created_date: '2026-10-09 14:31'
updated_date: '2026-10-09 14:31'
---
# Agent eval suite

**Status:** built for TASK-40 (decision-10: agent-first DX is measured; the design was approved by the user on 2026-10-09). Code: `evals/` (`@lumen/evals`). Owner: Quasar.

**Goal.** Measure how well real coding agents build with Lumen: fixed tasks, solved by the agent CLIs the user already pays for, graded only by hidden tests. Regressions in Lumen's agent-facing surface (docs, `AGENTS.md`, the skill, `lumen check`, `lumen mcp`) show up as lower pass rates or more turns.

## 1. Tasks

`evals/tasks/<id>/`:

- `task.json`: `title`, `category` (`scaffold`, `routing`, `styles`, `islands`, `actions`, `reactivity`), `template` (a create-lumen template, or `none` for an empty package), optional `remove`, `minutes` (wall-time budget, default 15), `maxTurns` (default 60).
- `prompt.md`: what the agent receives, verbatim. Prompts state observable requirements (URLs, text, status codes, file and export names the tests import) and that `lumen check` must pass.
- `start/`: files copied over the template.
- `hidden/`: Vitest acceptance tests, copied into the project (`eval-hidden/`) only after the agent finished, with `grader/helpers.ts` (`startDev`, `lumen`, `buildCss`, `islands`, `checkCodes`, `text`, `source`). Component behaviour is tested with `mount` in happy-dom; pages, endpoints and actions through `lumen dev`; CSS through `lumen build`.
- `solution/` (+ optional `solution.scripts.json`, `solution.remove.json`): a reference solution. `pnpm --filter @lumen/evals validate` checks every task: the hidden tests must fail on the start and pass on the solution.

20 tasks: scaffold 1, routing 5, styles 4, islands 5, actions 2, reactivity 3. `pnpm --filter @lumen/evals eval --list` lists them.

## 2. Runs

One run = one task × one agent config × one ablation × one repetition:

1. **Project.** A fresh directory under the OS temp dir (outside the repo, so no repo `AGENTS.md`/`CLAUDE.md` applies): the template scaffolded by create-lumen, the task's `start/` files, a `package.json` whose `lumen` and `@lumen/adapter-node` are `link:`s to a read-only snapshot of this repo's packages (Lumen ships TypeScript sources, which Node only runs outside `node_modules`), and Vite, TypeScript, Vitest, happy-dom, oxlint and oxfmt at the repo's versions. A lockfile resolved once per snapshot makes `pnpm install --offline` reproducible. The start state is committed to a fresh git repo.
2. **Agent.** The CLI runs in the project with the prompt on stdin:
   - Claude Code: `claude -p --output-format stream-json --model <id> --effort <e> --setting-sources project,local --strict-mcp-config --permission-mode acceptEdits --permission-prompts none --max-turns <n>`, Bash in Claude Code's sandbox (writes confined to the project, no network), no web tools. User-level CLAUDE.md, plugins and MCP servers are not loaded; the project's files are.
   - Codex: `codex exec --json --ephemeral --model <id> -c model_reasoning_effort=<e> --sandbox workspace-write` (no network, `approval_policy="never"`) with a private `CODEX_HOME` that only shares the login (`auth.json` symlink), so the user's config, `AGENTS.md`, skills and plugins do not apply.
   - Effort is `low`, `medium` or `high`, never higher. The wall-time budget kills the process group.
3. **Grading.** `lumen check` (errors fail the run) and the hidden tests. **Success** = all hidden tests pass and the check has no errors.

Runs are sequential; agents are interleaved within each task.

## 3. Ablations

| Id | `AGENTS.md` + `CLAUDE.md` + skill | `llms.txt` in `node_modules/lumen/docs` | `lumen mcp` registered |
|---|---|---|---|
| `baseline` (what create-lumen gives) | yes | yes | no |
| `mcp` | yes | yes | yes |
| `no-agents` | no | yes | no |
| `no-llms` | yes | no | no |
| `bare` | no | no | no |

The docs pages themselves are always installed: they are part of the package.

## 4. Metrics (per run)

Success, hidden tests passed/total, final `lumen check` (errors, warnings, codes), wall time, turns (Claude: `num_turns`; Codex: messages + tool calls), tool calls by kind, tokens (input, cache read/write, output, reasoning), list-price cost (Claude reports it; a proxy for subscription quota; Codex reports tokens only), `lumen check` runs and whether the first passed, LUM codes the agent's checks/builds reported, docs reads (`node_modules/lumen/docs`, `lumen docs`, `lumen explain`, MCP docs tools), `llms.txt` reads, MCP calls and tools, skills loaded, diff size, timeouts and CLI errors. Transcripts (JSONL) stay in `evals/.runs/` (git-ignored).

## 5. Results and viewer

`evals/results/<date>T<time>-<host>.json` (rewritten after every run; `meta.complete` is false until the matrix ends) and `results/index.json`. `pnpm --filter @lumen/evals run view` serves `evals/viewer/` (built on the fullstack bench viewer's styles): a summary per agent, success by category and by task (failures in tooltips), and every run, filterable by ablation.

## 6. Commands

- `pnpm --filter @lumen/evals eval --agents claude:claude-sonnet-5-5:medium,codex:gpt-6-astra:medium [--tasks a,b] [--runs 3] [--ablations baseline,mcp] [--keep]`
- `pnpm --filter @lumen/evals validate [--tasks a,b] [--keep]`
- `pnpm --filter @lumen/evals eval --list`
- `pnpm --filter @lumen/evals run view [--port 4110]`

Model ids (2026-10-09): Claude `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`; Codex `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna` (`codex debug models`).

## 7. Rules

- Full matrices only with Lux's go-ahead after a measured smoke (time and quota per run).
- Never above `high` effort.
- Hidden tests and solutions are never shown to agents; tasks change only with `validate` green.
