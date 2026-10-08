---
id: doc-3
title: Checkpoint and resume guide
type: guide
created_date: '2026-10-08 16:56'
updated_date: '2026-10-08 16:56'
tags:
  - checkpoint
  - resume
---
# Checkpoint and resume guide (2026-10-08)

**Checkpoint.** All agents are stopped and all work is committed on `main`. At the checkpoint, every check passed:
- `pnpm typecheck` was clean.
- `pnpm test`: 892 passed, 7 skipped.
- `pnpm lint` passed.
- `cargo test --workspace` passed.

Claims and locks are released.

**Sources of truth:**
- Architecture: spec doc-1.
- Compiler-runtime contract: doc-2.
- Decisions: `backlog/decisions/` (1–22).
- Workflow and ownership: `AGENTS.md`.
- Roster: `agents.json` (Lux, Prism, Photon, Halo, Spark, Nova, Beacon).

## Where we are

**M1 core: done.**
- The compiler (scanner, client/server codegen, CSS via `lumen_css` and Lightning CSS, `$tokens`, placement scopes) is in place.
- The runtime (signals, DOM, async + Suspense) is in place.
- `lumen/vite`, the JSX types, the LSP and the VS Code extension are in place.
- js-framework-benchmark: Lumen CPU 1.122 versus Solid 1.185 (TASK-12).

**M2 SSR: done except TASK-18.**
- Done: shell-first streaming, islands, server markers, and the CSS manifest.
- TASK-18 (hydration plus the island loader) is still open, with its end-to-end test pending.

**M3 app layer: mostly done.**
- Done: routes and typegen, request handler, actions, `lumen dev`, `lumen build`/prerender, the node adapter, and SSR performance (1.6× faster).
- Open: the SPA router (TASK-25) and `.md`/`.html` imports (TASK-69).

**M4 tooling: done.** `lumen check`/`lint`/`fmt`, the LSP with TS 7 takeover, the VS Code `.vsix` bundle, and the CLI (TASK-28).

**M5 docs: in progress.** The docs in the package are written. Still open: create-lumen (TASK-33), the MCP server (TASK-34), the website (TASK-57, TASK-59 done), the playground (TASK-58) and deploy (TASK-60).

**M6 samples:**
- Chiptune (TASK-35): playable, run with `cd examples/spa-chiptune && pnpm dev`.
- Bookshelf (TASK-36): data layer and first pages are done.
- SSG sample (TASK-37): not started.

## In-progress tasks

Each in-progress task has a RESUME note; read it with `backlog task view TASK-N --plain`.

| Task | Owner | State |
|---|---|---|
| TASK-18 hydration + loader | Spark | Implemented, with 12 tests. Next: the Playwright e2e in `examples/islands-e2e`. Size with hydration: 8.61 kB, under the 10 kB cap |
| TASK-35 chiptune app | Spark | Playable. Next: e2e with screenshots, `vite build`, WAV export check, README and perf note |
| TASK-36 bookshelf SSR app | Nova | Planned only. Data layer (TASK-46) and first pages (TASK-24) exist |
| TASK-33 create-lumen | Beacon | Templates and `agents init` are written. Blocked on TASK-77 (`lumen({ mode })`) |
| TASK-65 compiled-row memory | Photon | Row-data hoisting done (heap 2.09 → 1.89 MB). Needs AC #4 bench numbers and Lux's call on AC #2/#3 |
| TASK-54 Vitest browser conditions | Photon | Fix is in. The integration test is skipped, and the docs are pending |
| TASK-68 Remix 3 benchmark | Spark | Implementation passes the checks. Full rerun pending: `node scripts/jsfb.ts --count 10 --mem-count 3` (~35 min). **Run it with no other agents active** |
| TASK-76 CSS value warnings | Halo | Investigation only. The design (LUM3017–3019, allowlist) is in the notes |

## Recommended resume order

1. **TASK-77** (Photon): `lumen({ mode, ssr, … })` plugin options. This unblocks TASK-33 and decision-21.
2. **TASK-18** (Spark): finish hydration. Then **TASK-25** (Nova, SPA router), then **TASK-72**.
3. **TASK-35** (Spark): finish the chiptune app. **TASK-36** (Nova): the bookshelf app, whose islands need TASK-18.
4. **TASK-37** (Lux): the SSG sample. Then **TASK-38** (Prism): DX review of the three apps.
5. Performance:
   - TASK-65 and TASK-78 (Photon). TASK-78 needs a Lux decision on server prop evaluation timing.
   - TASK-68: rerun the benchmark on a quiet machine.
6. Website: TASK-73 and TASK-74 first, then TASK-57, TASK-58 and TASK-60.
7. Halo: TASK-76, then TASK-67, then the TASK-70 SVG study, which produces a recommendation for the **user to decide** before implementation.
8. Beacon: TASK-34 (MCP), TASK-53, and documentation follow-ups.

## Open decisions

**For the user:**
- SVG import and sprite approach, after the TASK-70 study.
- Final package names before publishing (TASK-39).

**For Lux:**
- TASK-78: server-side prop evaluation order.
- TASK-65: AC #2/#3.
- Ownership of `examples/islands-e2e` (proposed: Spark).

## How to resume

1. Start an orchestrator session (Lux). Read `AGENTS.md`, `agents.json`, this guide and `backlog task list -s "In Progress" --plain`.
2. Spawn workers with their nickname, the task IDs and the instruction to read the task's RESUME note first. Use the fewest workers that keep the critical path moving.
3. Rebuild the native compiler after pulling: `pnpm build:compiler`. To run everything: `pnpm check`.

**Caveats:**
- Benchmarks are noisy while agents are running.
- Agents may hit API session limits. Resume them by message, which keeps their context.
- pnpm 11 enforces a minimum release age, so new dependencies may need exclusions.
