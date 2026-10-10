---
id: doc-3
title: Checkpoint and resume guide
type: guide
created_date: '2026-10-08 16:56'
updated_date: '2026-10-10 00:23'
tags:
  - checkpoint
  - resume
---
# Checkpoint and resume guide (2026-10-09, night)

**State.** `main` is pushed to `origin` (github.com/itsjavi/lumen, private). The site deploys via GitHub Actions to **https://itsjavi.com/lumen/** (the Pages path follows the repository name: /lumiose/ once the repo is renamed to `lumiose`) (site, docs, playground, `/examples` "Made with Lumiose" incl. Dotmatrix and chiptune with a COOP/COEP service worker, `/benchmarks`). Workers were told to checkpoint with RESUME notes; read `backlog task list -s "In Progress" --plain` and each note first.

**Sources of truth:** doc-1 spec, doc-2 contract (incl. §2.1 dev-only `lumiose/dom/hot`), doc-4 fullstack benchmark, doc-5 eval suite, decisions 1–29, `AGENTS.md`, `agents.json`. License MIT.

## Done today (highlights)

- Security review (TASK-162) fully addressed: TASK-164..171, 169, 170, 178 (LUM4004 now emitted); decision-29 defaults (body limits, unsafe-URL blocking LUM4009, ErrorBoundary prod sanitisation, nosniff/Referrer-Policy, signed-cookie secret length, PUBLIC_ env prefix, dev fs.deny).
- CI on Linux/macOS/Windows + native binaries for 6 targets + wasm (TASK-161 done; remaining failures in TASK-179/180).
- HMR: island hot-swap (TASK-147) and component-level refresh incl. hydrated components (TASK-146), 0 B in production; TASK-148 (DOM morphing) deferred.
- Runtime size: every-export 9.73 kB (TASK-176, baseline ≤ 9.8 kB; cap 10 kB).
- Plugins (@lumiose/eslint-plugin for oxlint/ESLint, @lumiose/prettier-plugin), MCP boundaries, Pages examples/benchmarks.
- Agent eval suite (TASK-40, doc-5): 20 validated tasks, runner over local `claude -p` / `codex exec`, viewer (`pnpm --filter @lumiose/evals run view`). Smoke 20/20 passed.

**CI:** all green (CI run 37994401362 on Linux/macOS/Windows; Binaries 37995499815 on 6 targets + wasm; Pages deployed).

## Open work (owner → task)

| Owner | Task | State |
|---|---|---|
| Quasar | TASK-40 | option C complete: 120/120 passed (6 models, medium, results in evals/results/2026-10-09T151008-macbookpro.json); next step (harder tasks + ablations) waits for the user |
| Nova | TASK-175 adapters | waits for the adapter API decision |
| Lux | TASK-39 package names + split (runtime-only unscoped package, scoped tooling; prebuilt JS) | waits for the user |
| — | TASK-148 HMR DOM morphing (deferred), TASK-64 Lightning CSS upgrade (upstream) | |

## Decisions pending from the user

1. Package names: is the `@lumiose` npm org free; unscoped runtime package `lumiose-jsx` (recommended) or `lumiosex`.
2. Adapter API: `lumiose({ adapter: cloudflare() })` (recommended) or post-build commands.
3. Recompose the 5 songs failing the composition check (Rival Clash, Last Stand, Lantern Night, Bumbling Along, Roll the Credits)?
4. After option C results: run more eval variants (A or ablations)?

## Notes

- `examples/spa-chiptune/src/ui/TrackerView.stsx` has uncommitted, unformatted changes no worker claims (possibly the user's); `fmt:examples` will fail if committed as is.
- Two orphaned preview servers may still run (ports 4180, 4793); killing them was denied to agents — the user can stop them.

## How to resume

1. Orchestrator session (Lux): read `AGENTS.md`, `agents.json`, this guide, the In Progress tasks' RESUME notes.
2. `git pull`; `pnpm build:compiler`; `pnpm check`; `gh run list --limit 10`.
3. Restart workers with nickname + task ids (Opus, medium/high). Resume the eval only when quota allows.
