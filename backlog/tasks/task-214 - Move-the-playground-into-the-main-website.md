---
id: TASK-214
title: Move the playground into the main website
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 22:50'
updated_date: '2026-10-11 02:01'
labels:
  - site
milestone: m-7
dependencies: []
priority: high
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): apps/playground is a separate app with its own header, so the playground's top menu differs from the site's. Serve it as the /playground route of apps/web with the shared layout, header and footer, and remove the separate app from the site build. The WASM compiler loads only on that page. The editor becomes one island shared with the landing's live demo (TASK-211).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 /playground is a route of apps/web with the site's layout, header and footer; apps/playground no longer ships separately
- [x] #2 The WASM compiler and preview runtime load only on /playground (and in the landing demo island); other pages' payload is unchanged
- [x] #3 The playground's existing tests and e2e coverage pass in its new home; pnpm demo, build:site and the README are updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon 2026-10-11:
- /playground is now apps/web/src/routes/playground.stsx, inside the site's _layout (shared header with the active Playground link, footer, skip link), with a visually hidden h1 and its own description/OG meta. apps/playground is deleted (package, configs, document); pnpm-workspace picks up the change via pnpm install.
- Island: apps/web/src/islands/Playground.stsx, reusable for TASK-211: props `code?` (initial source) and `embedded?` (no sample menu, no Copy link, no URL-hash state). It loads its assets from link('/playground/generated/'). One instance per page (fixed tab/panel ids). Libraries moved to apps/web/src/playground/ (compiler, editor, preview, share, samples, stsx-language, runtime + playground.test.ts); docsLink moved to src/lib/site.ts; nav/footer/landing links use href('/playground').
- Assets: apps/web/scripts/playground-assets.ts writes public/playground/generated/{wasm/,runtime.js} (git-ignored). `build` runs it (strict), `dev` runs it with --optional (warns without the Rust/wasm-bindgen toolchain so the rest of the site still runs), `playground:assets` runs it alone. Codemirror/lezer deps moved to apps/web.
- Site build: scripts/site.ts builds only @lumiose/web (the playground ships with it); README 'Website' and 'pnpm demo' text updated; scripts/demo.test.ts no longer expects a 'playground' entry (pnpm demo web serves both; title 'Lumiose website and playground').
- Payload (AC2): other pages never reference the wasm, CodeMirror or the preview runtime (checked in the built HTML and by a new e2e that records requests on /, /docs/concepts/styles and /benchmarks). Limitation: the shared islands loader chunk grows by ~1.5 kB raw / 484 B brotli on pages with islands, because Rolldown hoists the runtime helpers the island uses (keyed selector, property setter) into the shared chunk; recorded as TASK-228.
- Tests: playground unit tests (10) now run in apps/web's vitest; playground e2e (4 + 1 new) run in apps/web's Playwright suite, whose webServer builds the assets first (CI's e2e job already discovers apps/*/playwright.config.ts and installs the wasm toolchain on Linux).
- Checks: lumiose check (web), vitest (web 18), node --test scripts/demo.test.ts, oxlint, oxfmt, web e2e 14 passed (web + playground). Evidence: backlog/assets/task-214-playground-dark.png, task-214-playground-phone.png.
- Left for Lux: pnpm-lock.yaml (importer apps/playground folded into apps/web, from pnpm install) is not committed (Lux-owned); the comment at the top of .github/workflows/pages.yml still names apps/playground (Photon-owned); the AGENTS.md ownership table lists apps/{web,playground}; the user's uncommitted .claude/launch.json lists @lumiose/playground.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The playground is the /playground route of apps/web with the site's layout; its editor is a reusable island (code, embedded props); the WASM compiler and preview runtime load only there (shared loader chunk +484 B br, TASK-228); apps/playground is gone from the repo and the site build; tests and e2e moved with it.
<!-- SECTION:FINAL_SUMMARY:END -->
