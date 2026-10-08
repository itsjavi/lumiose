---
id: TASK-54
title: Use lumen's browser entry in Vitest DOM environments
status: Done
assignee:
  - Photon
created_date: '2026-10-08 15:40'
updated_date: '2026-10-08 20:51'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while writing concepts/testing (TASK-32): with plugins: [lumen()] and a happy-dom/jsdom Vitest environment, `lumen` resolves to its node entry (index.server.ts: signals are plain cells, effects never run), so mounted components render once and never update. Verified in examples/vite-counter with a throwaway test: adding resolve.conditions: ["browser"] makes it pass. The docs currently tell users to add that condition. The plugin (or @lumen/testing) should select browser conditions for DOM test environments automatically, while server-side tests (renderToString) keep the node entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A component test with only plugins: [lumen()] and environment happy-dom sees reactive updates
- [x] #2 Server-render tests without a DOM environment still use the node entry
- [x] #3 packages/lumen/docs/concepts/testing.md and reference/vite.md drop the manual workaround
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-task19-20261008T161409Z) — RESUME (checkpoint, In Progress).
Done: root cause = Vitest sets Node conditions on every environment (incl. the 'client' env happy-dom/jsdom use), so 'lumen' resolved to index.server.ts. Fix in packages/lumen/src/vite/index.ts: resolveId for bare 'lumen' in client-consumer environments returns the package's exports['.'].browser (via this.resolve('lumen/package.json') + browserEntry() cache); server environments untouched. Verified manually in examples/vite-counter with a throwaway happy-dom test (fails without the redirect, passes with it; probe removed). tsc clean, src/vite tests 19 passed.
In progress: packages/lumen/src/vite/vitest.test.ts (spawns the Vitest CLI on a temp fixture with symlinked lumen/vitest/happy-dom; dom.test.ts + server.test.ts). Currently it.skip: the inner run's stdout had no JSON — next: print run.stderr/status, fix (likely config load or reporter flag), un-skip.
Next: AC#3 docs (packages/lumen/docs/concepts/testing.md lines ~14-74 and reference/vite.md:38 mention resolve.conditions ['browser'] — Beacon's files; coordinate or edit), update the index.ts header comment (line 7) to mention the Vitest case, check ACs, Done.

Photon (2026-10-08, resumed): the inner Vitest run printed no JSON because Vitest 5's json reporter writes to a file (.vitest/json/output.json) instead of stdout. packages/lumen/src/vite/vitest.test.ts now passes --outputFile=<tmp>/report.json, reads it, and is un-skipped: dom.test.ts (happy-dom, only plugins: [lumen()]) sees the click update and server.test.ts (node env) renders with renderToString on the node entry -> AC #1, #2. Negative check: forcing the resolveId redirect off makes dom.test.ts fail ('Clicked 0 times'), so the test guards the fix. Header comment of src/vite/index.ts mentions the Vitest case.
AC #3 (solo edit of Beacon's docs, scoped to this task): concepts/testing.md drops resolve.conditions ['browser'] (concept text, status note, API table row, example config, 'common mistakes' now says a missing DOM environment); reference/vite.md drops the Vitest status line and says DOM test environments get the browser entry. llms-full.txt regenerated (gen-llms); pnpm docs:check passes.
Left alone: examples/spa-chiptune/vite.config.ts still sets resolve.conditions ['browser'] in test mode; the file has uncommitted user/Spark changes, and the workaround is now redundant (owner may drop it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/vite gives Vitest DOM environments (client consumers with Node's conditions) the browser entry of lumen, so component tests with only plugins: [lumen()] update reactively, while node-environment tests keep the server entry. Guarded by src/vite/vitest.test.ts (spawns Vitest on a temp fixture; un-skipped after reading the JSON report from --outputFile). Docs no longer prescribe resolve.conditions ['browser'].
<!-- SECTION:FINAL_SUMMARY:END -->
