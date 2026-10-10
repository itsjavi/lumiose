---
id: TASK-39
title: 'Package split: runtime-only lumiose + @lumiose scoped packages (decision-31)'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-10 01:56'
labels: []
milestone: m-7
dependencies: []
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-15 keeps the working name lumen, which is taken on npm, until publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user approves final npm, crates and extension names (a naming and DX decision)
- [x] #2 A one-pass rename is applied across packages, crates, docs and examples; nothing has been published before the rename
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-10: names decided (decision-30) and layout approved (decision-31). Start after TASK-182 (rename) lands.

Photon — PLAN (2026-10-10, before TASK-182 lands; no code edited yet).

Inventory (packages/lumiose/src today): runtime = core, dom (+dom/hot dev-only, dom/loader, dom/hydrate), server, jsx (jsx-runtime + .d.ts), contract (types), app/{public*.ts, actions, server (request handler, node-http, csp, scope), router (except entry.ts), routes (except scan.ts), headers.ts, diagnostics.ts, fetch-json.ts}. Tooling = vite/, cli/, app/dev, app/production, app/typegen, app/router/entry.ts (a Vite plugin), app/routes/scan.ts (fs), app/project.ts (Vite types). Cross-boundary imports found: vite -> app/{server,routes,project,headers}, cli/check (writeLumenTsconfig); app/dev -> vite/{index,islands}, app/server/node-http, typegen; app/production -> vite/islands, app/server/*, typegen; cli -> app/routes, vite. Runtime -> tooling: only app/router/entry.ts and app/project.ts (both move to tooling). Third-party: @modelcontextprotocol/sdk + zod only in cli/mcp; svgo in vite/svg; yaml in vite/content.

Target packages (decision-31):
1. `lumiose` (packages/lumiose): the runtime list above. dependencies: none (node: builtins only; vite stays out). Subpath exports unchanged for users (., dom, dom/hydrate, dom/loader, dom/hot, server, router, jsx-runtime, jsx-dev-runtime, env, node). Plus one undocumented internal subpath for the tooling packages: `lumiose/internal` (re-exports the app-runtime pieces tooling needs: request handler, manifest types/createRouteManifest, headers, project option types, island/csp helpers) — avoids deep `src/` paths across packages.
2. `@lumiose/vite` (new packages/vite): src/vite + app/dev + app/production + app/typegen + app/router/entry.ts + app/routes/scan.ts + app/project.ts + cli/check/layout.ts (writeLumiosTsconfig). Exports: `.` (plugin), `./dev`, `./build`, `./typegen`. deps: @lumiose/compiler, svgo, yaml; peer: vite, lumiose.
3. `@lumiose/cli` (new packages/cli): src/cli (bin `lumiose`), deps: @lumiose/vite, @lumiose/compiler, @modelcontextprotocol/sdk, zod; peer: vite, typescript (optional). `./tooling` and `./agents` exports move here (language-server, eslint/prettier plugins import @lumiose/cli/tooling).
4. `@lumiose/compiler`: unchanged code; publish layout from napi: `napi create-npm-dirs` -> npm/<platform>/package.json (`@lumiose/compiler-darwin-arm64`, -darwin-x64, -linux-x64-gnu, -linux-arm64-gnu, -linux-x64-musl, -win32-x64-msvc, plus -wasm32-wasi) as optionalDependencies; the Binaries workflow artifacts fill them in CI.
5. adapter-node, language-server, eslint-plugin, prettier-plugin, create-lumiose: deps re-pointed (lumiose runtime, @lumiose/cli tooling). `@lumiose/testing`: no package today — create it from the test helpers apps/examples use (mount/render helpers, renderToString wrappers) if Lux agrees; otherwise leave a stub out of scope (needs a call).

Build/publish mechanics:
- Workspace keeps TS sources (exports -> src/*.ts) so dev, tests and type stripping stay as today; published packages use `publishConfig.exports`/`publishConfig.bin` -> dist (pnpm applies publishConfig on pack/publish).
- Build per package with TS 7 `tsc -p tsconfig.build.json` (emit JS + .d.ts, rewriteRelativeImportExtensions, verbatimModuleSyntax), `prepack` script runs it. Node cannot strip types under node_modules, so prebuilt JS is required.
- `files`: dist, docs (lumiose only), README, LICENSE; exclude **/*.test.*, __fixtures__, __tests__, .fixtures, test/out.
- Compiler already emits `lumiose/*` after the rename (lumiose/dom, lumiose/server, lumiose/dom/hot).

Repo updates: templates (packages/create), examples, benchmarks, evals, apps: `lumiose` in dependencies, `@lumiose/vite` + `@lumiose/cli` in devDependencies; vite.config `import lumiose from "@lumiose/vite"`; docs (getting-started, reference/vite, cli, AGENTS template) list the three packages.

CI: new job `pack` (ubuntu): build all publishable packages, `pnpm -r pack --pack-destination dist/packs`, a script asserts tarball file lists (no tests/fixtures, dist present, no workspace: ranges left), `npm publish --dry-run` per tarball, then install the tarballs into a scratch copy of the create-lumiose template (no workspace links) and run `lumiose build` + a smoke render to prove the prebuilt packages work from node_modules. No real publishing.

Order: (a) move modules + internal subpath, keep everything green (vitest, check); (b) new packages + deps; (c) build/pack + CI job; (d) templates/examples/docs; commit per step. Open questions for Lux: @lumiose/testing content; whether `lumiose/node` (node-http adapter helper) stays in the runtime (plan: yes, it's runtime and dep-free).

Photon (2026-10-10): Lux approved the plan, lumiose/internal (undocumented, tooling only) and prebuilt dist via publishConfig. @lumiose/testing is out of scope (dropped from the layout); lumiose/node stays in the runtime package. Waiting for Lux's go after TASK-182 lands.

Quasar → Photon (TASK-184): every HTML-serving package now has a small `demo` field in package.json ({title, kind, name?, setup?}); please keep it when you move or rewrite package.json files. scripts/demo.ts finds packages through pnpm-workspace.yaml globs and their dev/view/start/serve/preview scripts, so moved packages keep working as long as those scripts exist.

Photon (2026-10-10): step 1 done, 8b13833 + docs 10d159b. Tooling moved to packages/vite (@lumiose/vite: plugin, /dev, /build, typegen, layout) and packages/cli (@lumiose/cli: bin, check/lint/fmt, docs, mcp, /tooling, /agents); lumiose has no dependencies (svgo, yaml, MCP SDK, zod moved). Cross-package imports use <pkg>/internal/*. Runtime entries the plugin names by path resolve through lumiose/internal (packages/vite/src/runtime-files.ts). Linked-package scans skip lumiose/@lumiose/{vite,cli,compiler}. Consumers (examples, apps, benchmarks, evals, create-lumiose templates) depend on lumiose + @lumiose/vite + @lumiose/cli (dev). Root check runs node --test scripts/*.test.ts (Lux). demo fields kept (oxfmt moved them to the end). Validation: full vitest 1424 passed, typecheck, oxlint, docs:check, fmt:examples, size, node --test, builds of ssr-bookshelf/vite-counter/spa-router-e2e/apps/web, e2e vite-counter/islands-e2e/spa-router-e2e. GitHub Actions did not start any job (account billing / spending limit), so CI, Binaries and Pages cannot be confirmed remotely. AGENTS.md ownership table still lists packages/lumiose/src/vite/** and src/cli/** (Lux's file): now packages/vite/** and packages/cli/**.

Photon (2026-10-10): step 2 8114264 (dist build via scripts/build-package.ts + tsconfig.build.json, publishConfig exports/bin -> dist, pnpm pack:check with npm publish --dry-run and a create-lumiose smoke app, CI pack job), evals vendoring ad5b6a1, compiler platform packages b1a7ef0 (packages/compiler/npm/<platform> as workspace packages, optionalDependencies workspace:*, musl + wasm32-wasi targets, napi-wasi Binaries job, CI/Binaries paths-ignore backlog/**), 983cc10 (os/cpu/libc in publishConfig: pnpm printed Unsupported platform warnings that broke the e2e Playwright version step). CI, Binaries and Pages green on b1a7ef0 except that e2e step, fixed in 983cc10 (e2e green on all three OSes). Remote checks resumed once Actions billing was fixed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose is the runtime only (no dependencies); @lumiose/vite holds the plugin, dev server, build and typegen; @lumiose/cli holds the lumiose command, check/lint/fmt, docs, MCP, /tooling and /agents. Packages reach each other through the undocumented <pkg>/internal/*.ts subpath. Published packages ship a prebuilt dist/ (publishConfig), checked by pnpm pack:check (tarball contents, exports, npm publish --dry-run in publish order, smoke app from the tarballs) in CI. @lumiose/compiler ships its loader; binaries come from @lumiose/compiler-<platform> optional dependencies (7 targets incl. musl and WASI). Templates, examples, apps, benchmarks and evals depend on lumiose + @lumiose/vite + @lumiose/cli; docs updated. Follow-up for Lux: AGENTS.md ownership table still names packages/lumiose/src/vite/** and src/cli/** (now packages/vite/** and packages/cli/**).
<!-- SECTION:FINAL_SUMMARY:END -->
