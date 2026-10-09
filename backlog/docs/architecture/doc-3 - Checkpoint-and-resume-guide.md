---
id: doc-3
title: Checkpoint and resume guide
type: guide
created_date: '2026-10-08 16:56'
updated_date: '2026-10-09 03:42'
tags:
  - checkpoint
  - resume
---
# Checkpoint and resume guide (2026-10-09)

**Checkpoint.** All agents are stopped and all work is committed on `main`. No claims or locks are held. Last agent reports: `pnpm typecheck`, `pnpm lint` and `pnpm test` (1072 passed) green; `cargo test`/clippy/fmt green for the touched crates. `pnpm --filter lumen size:apps` fails on purpose for spa-chiptune (TASK-106).

**Sources of truth:** spec doc-1, contract doc-2, decisions 1–25 in `backlog/decisions/`, `AGENTS.md` (workflow, ownership), `agents.json` (Lux, Prism, Photon, Halo, Spark, Nova, Beacon).

## Where we are

- **M1 core, M2 SSR/islands, M3 app layer, M4 tooling: done.**
- **M5 docs/agent DX:** docs, create-lumen, `lumen mcp` (TASK-34), website `apps/web` (TASK-57), playground `apps/playground` (TASK-58) done. Open: GitHub Pages deploy (TASK-60; CI needs the `wasm32-unknown-unknown` target and `wasm-bindgen-cli@0.2.129`, see the TASK-58 note).
- **M6 samples:** spa-chiptune, ssr-bookshelf, ssg-travel-journal done with e2e. Open: Prism DX review (TASK-38).
- **Latest work (2026-10-09):** SVGO replaces OXVG (TASK-96, native binary 18.1 → 12.9 MB incl. `.md`/`.html`); `.md`/`.html` imports via `crates/lumen_content` (TASK-69, Halo owns it); runtime chunking and size check (TASK-91); `insertText` (TASK-90); class scope forwarding (TASK-92); subtree scopes in lumen_css (TASK-88); `href()` base/trailingSlash (TASK-101); island records with custom documents (TASK-103); auto-invalidate after `submit()` (TASK-105); LUM2001 server reads (TASK-86); LUM6001 (TASK-53).

## Open tasks

| Task | Owner | Note |
|---|---|---|
| TASK-85 (HIGH) `.stsx` stylesheet links in `lumen dev` | Photon | Not started |
| TASK-65 compiled rows | Photon | In Progress; codegen rule for `insertText` is in the notes (from Spark) |
| TASK-62, TASK-63 | Photon | Not started; were waiting on Halo's lumen_napi/vite edits, now committed |
| TASK-104 flaky css-manifest test | Photon | |
| TASK-107 relative asset URLs in `.md`/`.html` | Halo | |
| TASK-106 SPA size budget | Lux/user | See open decisions |
| TASK-68 Remix 3 benchmark rerun | Spark | Run on a quiet machine only (~35 min) |
| TASK-60 deploy, TASK-38 DX review | Lux, Prism | |
| TASK-39/40/41/64 | various | Low priority |

## Open decisions

**For the user (DX):**
- TASK-106: spa-chiptune ships 11.18 kB framework JS (router 3.69 kB) against the 10 kB cap. Options: a separate SPA budget that counts the router, or slim the router (History fallback on demand saves ~0.4 kB, not enough alone). The spec's cap (doc-1 §6) does not name the router.
- TASK-105 side effect: on MPA pages `invalidate()` reloads, so a successful `submit()` reloads and loses `actionData()`. Alternative: re-run island async components without a reload (needs a `dom/async.ts` change).
- TASK-69 semantics Halo chose, to confirm: head `<style>`/scripts kept for full `.html` documents; a nested `<style>` scopes to its element's subtree (decision-23); `<script>` in Markdown follows the `.html` rule; frontmatter typed by merging into a `Frontmatter` interface.

**For Lux:**
- TASK-86 follow-up: a server page deriving from its own props (`params.slug.toUpperCase()`) still warns LUM2001; fixing it needs the route mode in Vite/`lumen check`.
- Add `size:apps` to CI once TASK-106 settles.

## How to resume

1. Start an orchestrator session (Lux). Read `AGENTS.md`, `agents.json`, this guide and `backlog task list -s "In Progress" --plain`.
2. Rebuild the native compiler after pulling: `pnpm build:compiler`; run everything with `pnpm check`.
3. Spawn the fewest workers that keep the critical path moving (suggested: Photon on TASK-85 → 62/63 → 65; Halo on TASK-107; then TASK-60 and TASK-38).

**Caveats:** benchmarks are noisy while agents run; agents remove only locks they created; pnpm 11 enforces a minimum release age for new dependencies.
