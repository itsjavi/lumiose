---
id: TASK-28
title: Implement the lumen CLI
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:42'
labels: []
milestone: m-4
dependencies:
  - TASK-27
  - TASK-26
  - TASK-24
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One CLI gives humans and agents every entry point, with machine-readable output (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Commands: dev, build, preview, check, typegen, routes, explain, docs (delegating to the app layer where applicable)
- [x] #2 --format json on every command; stable exit codes; help text
- [x] #3 Smoke tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Command registry in cli/main.ts (name, args, summary, options, positionals, exit codes, examples) driving validation, per-command help, JSON help and did-you-mean.
2. Output contract in cli/output.ts: exit codes 0/1/2 and the --format json envelope { command, ok, ...payload, failure? }; retrofit check/lint/fmt/docs/explain.
3. New commands: typegen (route types + syncShadows), routes (table + JSON) in cli/routes.ts; dev/build/preview with JSON in cli/app.ts.
4. Project default mode (decision-21) read from the lumen plugin's api.options (cli/project.ts) for check/typegen/routes.
5. Subprocess smoke tests on a fixture app; docs/reference/cli.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-27):
- `lumen typegen` must also sync shadows (syncShadows from src/cli/check/shadow.ts).
- `lumen check` should scan .tsx files too, to report LUM1006.

Beacon: done in a standalone worker run.
- Envelope: every command prints { command, ok, ... } with --format json; ok === (exit 0); failure { message, help? } when no diagnostics explain a failure; usage errors too (unknown command → suggestions[]). Logs go to stderr in JSON mode (build passes logLevel 'warn' + a stderr logger: Rolldown's native reporter prints progress straight to stdout at info).
- Exit codes: 0 ok, 1 problems (errors, unformatted, not found, build failed, server could not start), 2 tool failure/misuse. dev exits 143 on SIGTERM (Vite's handler).
- Global options --root/--cwd (alias), --format, --help on every command; lumen help [cmd] [--format json]; -v/--version (JSON too).
- lumen check: already scanned .tsx for LUM1006 (compile.ts provider, covered by check.test 'reports compiler diagnostics for .stsx and .tsx files'). Fixed: route diagnostics now use the project default mode (a server-default project no longer gets a false LUM5005); app diagnostics now carry docs: diagnostics/LUMxxxx.
- app/production/command.ts (Nova's, written for this task): extracted startPreview() from previewCommand (no behaviour change) so the CLI can print the URL as JSON. app/*/command.ts devCommand/buildCommand stay exported (lumen/dev, lumen/build) but the CLI now uses createDevServer()/build() directly.
- fmt: FmtOptions.format (oxfmt override) renamed to formatter; fmtCommand takes format (output).
- Found: lumen({ mode, ssr }) is not implemented in the Vite plugin (no options, no api.options) → TASK-77 (Photon). The smoke fixture sets plugins[0].api = { options: { mode: 'server' } } until then.
- Evidence: packages/lumen/src/cli/cli.test.ts (8 subprocess tests: help/JSON help/version, typos + misuse exit 2, routes table + JSON, typegen, check/lint/fmt envelope, docs/explain, build JSON + preview + dev via fetch). pnpm vitest packages/lumen/src/cli + app/production/command.test.ts: 59/59. pnpm typecheck ok. pnpm test: 12 failures, all in others' WIP (server ssr/render escaping: Nova TASK-71; dom/hydrate: Spark TASK-18; compiler server.test). pnpm lint: 1 error in packages/lumen/src/dom/hydrate.test.ts (Spark WIP). docs:check ok.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One coherent lumen CLI: a command registry (dev, build, preview, check, typegen, routes, lint, fmt, docs, explain) with per-command help and examples, JSON help for agents, did-you-mean for typos, --root/--cwd and --format json on every command with the stable envelope { command, ok, ... } and exit codes 0/1/2. New: lumen typegen (route types + shadow sync), lumen routes (table/JSON with pattern, file, kind, mode, ssr, layouts, params), JSON output for dev/preview (one line with the URL) and build (outputs + prerendered files). Route diagnostics honour lumen({ mode }) (decision-21) via the plugin's api.options; the plugin side is TASK-77. Docs: reference/cli.md rewritten. Tests: cli.test.ts subprocess smoke tests on a fixture app.
<!-- SECTION:FINAL_SUMMARY:END -->
