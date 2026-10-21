---
id: decision-76
title: CI fixes the cause of a failing test; retries only for named network flakes
date: '2026-10-21 04:58'
status: accepted
---
## Context

CI failed on every push from 2026-10-15 to 2026-10-21 (six runs after the last green one, 7db9db0d), each time for what looked like a different reason. The UI browsers workflow failed in all four of its runs. The failures had ten distinct causes:
- **Deterministic on Linux.** Five tests were written and checked on macOS only, or in the Playwright Docker image, which lacks DejaVu Sans:
  - wide fallback fonts broke two 320 px reflow checks (TASK-505);
  - with the same fonts, a popup covered the button the popover axe test clicks next, in Firefox and WebKit (TASK-513);
  - classic scrollbars broke the drawer's width check (TASK-506);
  - a copy change left the landing test behind (TASK-504).
- **Flaky.** Three tests depended on timing:
  - an F6 pressed between an island's hydration and the replay of its held click (TASK-509, runtime cause in TASK-508);
  - a language server shutdown that outlasted the 10 s hook timeout on Windows (TASK-510);
  - two watcher events for one write in the dev server test (TASK-502).
- **Network.** One npm connection reset from the registry (TASK-511).

Meanwhile, the single Linux e2e job grew from 12 to 25–30 minutes against a 30-minute timeout (TASK-512).

A local run under load found one more timing cause that CI had not hit yet: ui-e2e loops that click until an island hydrates. They click again after the replayed click has opened an overlay, or count each held click (TASK-514).

Retries would have turned most of these green while hiding them. Five were real failures on every Linux run, and one exposed a runtime ordering bug.

## Decision

Orchestrator decision (delegated to Beacon by Lux, 2026-10-21, for TASK-502 and TASK-504 to TASK-514).

- **No retries for tests.** No Playwright `retries` and no Vitest `retry` in CI. A failing or flaky test gets its cause found and fixed in the test or the code: wait on the condition the behaviour needs, not on time, and compare with what the platform renders. If a cause can be named but not removed, a retry is allowed next to it, with the reason. Today that is only the registry's network: `pack:check` installs with `--fetch-retries=5` (TASK-511).
- **Linux e2e in two jobs.** CI's Linux e2e runs as two jobs of about 15 minutes each, each with its own results artifact:
  - `site`: apps/web, with the WebAssembly toolchain for the playground;
  - `examples`: every examples/* suite, vite-counter first.

  macOS and Windows keep the smoke subset (`smoke`). The extra job costs one more setup (about 3 minutes of runner time). The other ways to stay under the timeout were worse: a longer timeout keeps the 30-minute wall time, and more Playwright workers per suite would need every suite checked for tests that share a server's state (the HMR specs edit files).
- **Linux rendering.** Layout checks (widths, reflow, scrollbars) must pass with Linux's rendering, where fonts fall back to DejaVu Sans and scrollbars are classic (15 px). Before pushing such a test, run it in Linux Chromium: the Playwright Docker image's `run-server` (CONTRIBUTING.md) with `fonts-dejavu-core`, as for Firefox and WebKit.

## Consequences

- A red CI run means a real failure, or a flake to diagnose, never one to re-run.
- Each Linux e2e job finishes in about half its timeout. Their names are now `e2e (ubuntu-latest, site)`, `e2e (ubuntu-latest, examples)` and `e2e (<os>, smoke)`. No branch protection requires the old names.
- Tests that measure layout compare with the page as rendered (the root's width, `clientWidth`), not with the viewport size.
