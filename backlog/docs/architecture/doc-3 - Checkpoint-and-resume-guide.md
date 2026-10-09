---
id: doc-3
title: Checkpoint and resume guide
type: guide
created_date: '2026-10-08 16:56'
updated_date: '2026-10-09 12:37'
tags:
  - checkpoint
  - resume
---
# Checkpoint and resume guide (2026-10-09, evening)

**State.** Work is committed on `main` and pushed to `origin` (github.com/itsjavi/lumen, private). The website deploys through GitHub Actions to **https://itsjavi.com/lumen/** (site, docs, playground, `/examples` "Made with Lumen", `/benchmarks`). CI (Linux/macOS/Windows) and native-binary workflows exist (TASK-161, Photon, may still be stabilising). Workers were told to checkpoint with RESUME notes on their tasks; read `backlog task list -s "In Progress" --plain` first.

**Sources of truth:** spec doc-1, contract doc-2, fullstack benchmark doc-4, decisions 1–29, `AGENTS.md` (ownership, commits, lock rules), `agents.json` (Lux, Prism, Photon, Halo, Spark, Nova, Beacon, Quasar, Chime). License: MIT (root `LICENSE`).

## Done since the last checkpoint (highlights)

- Benchmarks: fullstack comparison (doc-4, m-8) with harness, conformance suite and viewer (dev/build/prod labelled); quiet full runs committed. Lumen leads req/s on every route, JS payload, interactivity, build and dev start; loses on production dependency count (fixed by the package split). js-framework-benchmark: Lumen 1.047 (projected 1.086) vs Solid 1.124, Vue Vapor 1.084, Svelte 1.150, React 1.543, Remix 3 1.564.
- Performance: server props evaluated once (decision-28), static index / memoized imports (+41–88% req/s on light routes), hydration adopts nodes in place (LCP = FCP), insertText codegen, minified server output.
- Security (TASK-162 review → TASK-164..171, decision-29 defaults): //host URL fix, body limits `lumen({ limits })`, unsafe URL blocking (LUM4009), ErrorBoundary production sanitisation, CSP strict mode with automatic nonces (decision-27), adapter-node hardening, MCP boundaries, client navigation scheme allowlist.
- DX: route-literal types and inferred action types (decision-26), route(), .md headings, lumen({ headers }), create-lumen --mcp (Claude Code + Codex), ESLint/oxlint and Prettier plugins, island hot-swap in dev (TASK-147).
- Samples: Dotmatrix (Game Boy chiptune studio on the user's gbapu engine: 12 songs, 20 SFX, 20 creatures, code editor/export) and chiptune on GitHub Pages with a first-party COOP/COEP service worker.

## Open work (owner → task)

| Owner | Task | Note |
|---|---|---|
| Photon | TASK-161 CI + native binaries | check `gh run list`; RESUME note on task |
| Photon | TASK-170 scanner/oxc depth limits, LUM4003 bypasses, PUBLIC_ env prefix, dev fs.deny | high, security |
| Photon | TASK-146 component-level HMR | approved, after 170 |
| Halo | TASK-169 SVG sanitizer allowlist, CSS/SVG depth limits, CSS `$` breakout, md/html quadratic parsing | high, security; LUM3021 docs may be uncommitted |
| Spark | TASK-176 runtime headroom (every-export 9.97 kB vs 10 kB cap) | |
| Quasar | TASK-154 harness interleaving, then TASK-40 agent eval suite | smoke run (5 tasks × 1 run × 4 models via local `claude -p` / `codex exec`) needs Lux's review of time/quota cost before the full matrix |
| Nova | TASK-175 adapters (Cloudflare, Vercel, Netlify) + deploy docs | waits for the adapter API decision |
| Lux | TASK-39 package names and split | waits for the user |
| — | TASK-148 HMR DOM morphing | deferred |
| — | TASK-64 Lightning CSS upgrade | waits for upstream release |

## Decisions pending from the user

1. **Package names:** whether the `@lumen` npm org is free (check by creating it on npmjs.com) and the unscoped runtime package: `lumen-jsx` (recommended; `create-lumen-jsx` also free) or `lumenx`. Proposed layout: runtime only in the unscoped package (`x`, `x/dom`, `x/server`, `x/router`); scoped `@lumen/vite`, `@lumen/cli`, `@lumen/compiler(-<platform>)`, `@lumen/adapter-*`, `@lumen/create`, `@lumen/language-server`, `@lumen/eslint-plugin`, `@lumen/prettier-plugin`, `@lumen/testing`. The split also ships prebuilt JS (lets Node servers keep the runtime external) and drops MCP SDK/svgo/yaml from production installs.
2. **Adapter API (TASK-175):** A `lumen({ adapter: cloudflare() })` (recommended, matches the spec) or B post-build commands.
3. **Composition check:** whether Chime should recompose Rival Clash, Last Stand, Lantern Night, Bumbling Along and Roll the Credits.

## How to resume

1. Start an orchestrator session (Lux). Read `AGENTS.md`, `agents.json`, this guide, then `backlog task list -s "In Progress" --plain` and each task's RESUME note.
2. `git pull`; rebuild the native compiler (`pnpm build:compiler`); run `pnpm check`.
3. Check CI: `gh run list --limit 10`.
4. Restart workers with their nickname and task ids (Opus; effort medium/high by complexity). Avoid running benchmarks while agents are active.
