---
id: TASK-39
title: 'Package split: runtime-only lumiose + @lumiose scoped packages (decision-31)'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-10 00:24'
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
- [ ] #1 The user approves final npm, crates and extension names (a naming and DX decision)
- [ ] #2 A one-pass rename is applied across packages, crates, docs and examples; nothing has been published before the rename
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
<!-- SECTION:NOTES:END -->
