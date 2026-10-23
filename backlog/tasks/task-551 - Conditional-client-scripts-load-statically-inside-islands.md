---
id: TASK-551
title: Conditional ?client scripts load statically inside islands
status: Done
assignee:
  - Photon
created_date: '2026-10-23 22:45'
updated_date: '2026-10-23 23:11'
labels:
  - vite
  - ui
  - performance
dependencies: []
priority: low
ordinal: 543000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui 0.1.2 pass (2026-10-24), also noted by Halo in TASK-541. An island (client:load) that renders `<Popover.Root><Popover.Trigger>Open</Popover.Trigger><Popover.Popup>…</Popover.Popup></Popover.Root>` without openOnHover still loads popover-hover.script and the shared hover chunk (about 1 kB brotli): in client bundles, a component's `?client` import becomes a static side-effect import, so a guard like `if (openOnHover) popoverHoverScript()` has no effect there. The same Popover in server HTML loads neither. Other conditional `?client` scripts that island components import probably behave the same.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inside islands, a ?client script that a component calls only conditionally is loaded only when called (or the docs explain why not and ui avoids the pattern)
- [x] #2 A build test with an island that renders a Popover without openOnHover shows no hover chunk
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-20261024T-t551) started.

Photon (2026-10-24, worktree run for Lux).

Cause: in client environments the ?client module was `import "<file>"; export default function clientScript() {}`, a static side-effect import, so a guarded call still shipped the script with the island: Popover's hover script and, through `if (modal) dialogScript()`, Dialog's script.

Fix (packages/vite/src/client-scripts.ts):
- A normal-order transform, lumiose:client-script-calls, parses each client module that mentions ?client (after the Lumiose compile and TypeScript, before its imports resolve) with conditionalClientScripts(). A default import that the module calls, but never as a statement of its own in a function body or at the top level, and uses in no other way, is recorded for that importer.
- resolveId gives those imports a \0lumiose:client-script-lazy: module whose default export runs import() on the script at its first call, once. Unconditional calls, other uses (passed on, re-exported), side-effect or namespace imports, and modules that do not parse keep the static import, as before. Server environments are unchanged.
- generateBundle keeps an emitted script's facade chunk when an import() targets it. It used to delete the facade when the script lives in a chunk shared with an island that imports it eagerly, which would make the lazy import 404. The build test covers this.
- Timing: a lazy script runs after the call, as an async module script does on server pages. A server-rendered island's page already loads it from its HTML, so the import resolves to the same module. A custom element that an island passes properties to must still be defined by an unconditional call; the docs say so.

ui (Halo's area, smallest change): Popover.Trigger now calls popoverHoverScript() inside the true branch of its reactive hover(), instead of an untracked check. An island whose openOnHover turns on after the first render still loads the script. A modal or disabled trigger, which renders no hover attributes, no longer records it.

Sizes: brotli q11 of each file as served. App: lumiose build, one client:load island rendering Popover.Root, Trigger and Popup. Measured: the page's static JS (module scripts, modulepreloads and their static imports).
- Before: 15,880 B. loader 8,384, island 2,259, popover.script 2,737, dialog.script 1,581, popover-hover.script 919.
- After: 13,488 B (-2,392 B, -15%). loader 8,357, island 2,394 (+135 for two lazy loaders), popover.script 2,737.
- With openOnHover: 14,418 B. The server HTML loads popover-hover.script; dialog stays lazy.

Tests (packages/vite/src/client-scripts.test.ts):
- conditionalClientScripts unit tests.
- Build fixture: a conditional call is not loaded statically; its import() target exists and defines the element, also when another island imports the script eagerly (shared facade); pages whose island calls it, or imports it eagerly, still load it.
- Dev test: the client transform imports the lazy module, which calls import() on the script.
- @lumiose/ui build: an island with a plain Popover statically loads only popover.script and calls import() for dialog.script and popover-hover.script.

Docs: concepts/islands.md, guides/web-components.md, reference/vite.md and llms-full.txt (regenerated). Also two comments: the doc comment of the *?client type in src/jsx/client-modules.d.ts (Beacon's area) and the comment in src/server/client-script.ts (Nova's area).

Checks:
- pnpm check (napi compiler rebuilt): green, vitest 2546 passed and 2 skipped, cargo tests green.
- docs:check for lumiose and @lumiose/ui: green.
- ui-e2e, dev and build: popover, popover-hover-modal, tooltip and preview-card specs (156 passed, 4 skipped); select, layers and dialog specs (87 passed, 1 skipped).

Follow-up, not done (Halo): Select.Item calls selectScript() under an untracked label check. In an island, a label that appears after the first render now loads no script; with the static import, the script was always there. Low impact: the customizable picker shows the label text, as server HTML does before the script runs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Islands and SPA pages load a ?client script that a module only calls conditionally on its first call, through a lazy ?client module, instead of with the module: an island rendering a plain Popover drops the hover and dialog scripts (15.9 to 13.5 kB brotli). Popover.Trigger calls its hover script inside its reactive branch. Docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
