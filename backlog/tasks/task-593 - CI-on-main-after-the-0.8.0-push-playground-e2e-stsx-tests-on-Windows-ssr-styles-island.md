---
id: TASK-593
title: >-
  CI on main after the 0.8.0 push: playground e2e, stsx tests on Windows,
  ssr-styles island
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-25 04:58'
updated_date: '2026-10-25 05:02'
labels:
  - ci
  - tests
milestone: m-14
dependencies: []
priority: high
ordinal: 585000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI run 40158676773 on main (712e509f, v0.8.0) failed in three jobs. 1) e2e site: playground.e2e.ts edits `const gap = 8;` in the landing sample, which TASK-586 replaced with custom properties. 2) check (windows-latest): 8 @lumiose/stsx tests (hmr, fs-access, typegen) failed on the package's first Windows run. 3) e2e examples: ssr-styles-e2e 'the island hydrates the server HTML and its classes change' failed in dev (aria-pressed stayed false); it passes locally. Fix the causes (decision-76), not with retries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The playground e2e edits the current landing sample
- [ ] #2 The stsx tests pass on Windows: the cause of each failure is found and fixed
- [x] #3 The cause of the ssr-styles island failure is found and fixed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux):

**1) Playground e2e.** It now edits `--space: 8px;` into `80px` and expects `--space: 80px` in the CSS output. Passes locally (static project).

**2) stsx tests on Windows** (8 failures). The failing tests were the only ones that copy a fixture to the OS temp directory and link the package's node_modules with a junction; the tests that use the fixtures in place, which resolve `react` too, passed on Windows. Three causes:
- **`react` did not resolve** (5 hmr tests, failing in their shared beforeEach). It was deterministic, not flaky. On GitHub's Windows runners the checkout is on D: and the temp directory on C:, so the junction crossed drives, and Vite 8 resolves bare imports in dev with Rolldown's native resolver.
- **Shared cache.** Every server shared packages/stsx/node_modules/.vite (Vite's cacheDir comes from the nearest package.json), so concurrent test files rewrote each other's optimized dependencies: about 60 leftover deps_temp_* folders locally.
- **`tsc` could not be spawned** (2 typegen tests): node_modules/.bin/tsc is a shell script, which Windows cannot spawn (status null).

Fixes:
- test/project.ts copies fixtures into packages/stsx/test/.tmp/ (gitignored), so resolution walks up to the package's node_modules as in a real project, with no junction.
- Each copied project gets its own cacheDir; the in-place servers of plugin.test.ts and sourcemap.test.ts get one per file.
- tsc runs as `node <typescript>/bin/tsc`.
- fs-access: Vite itself answers `?raw` (the plugin leaves it alone). It gives 403 on macOS and Linux and 404 on Windows, without the file either way; the test accepts both and still checks the body. The plugin's own URLs gave 403 on Windows too.

Locally the 26 stsx tests pass from a clean cache. The drive hypothesis cannot be confirmed without Windows: AC #2 waits for the next CI run.

**3) ssr-styles island** ('the island hydrates the server HTML and its classes change', dev).
- The test holds the island's module until it has tagged the server nodes, then clicks. The dev page also has `<link rel="modulepreload" href="/src/islands/Toggle.stsx?import">`, which the test's filter matches, so the held request can come before the island loader has run. A click then lands before anything catches it.
- Reproduced locally by delaying the loader by 1.5 s: the old flow fails as in CI (aria-pressed stays "false"), and waiting for hydration passes.
- The test now waits for the island's delegated handler (`$$click`) before clicking. Not a product bug: no JavaScript has run to catch the click. Event replay before hydration stays covered by the island tests (TASK-508, TASK-534).
- The suite passes 10/10 locally. No other test uses this hold-and-release pattern.
<!-- SECTION:NOTES:END -->
