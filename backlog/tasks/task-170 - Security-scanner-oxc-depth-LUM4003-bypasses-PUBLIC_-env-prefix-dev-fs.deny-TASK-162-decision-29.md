---
id: TASK-170
title: >-
  Security: scanner/oxc depth, LUM4003 bypasses, PUBLIC_ env prefix, dev fs.deny
  (TASK-162, decision-29)
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-09 12:10'
updated_date: '2026-10-09 12:38'
labels:
  - security
  - compiler
  - vite
milestone: m-7
dependencies: []
priority: high
ordinal: 170000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism TASK-162: H1 deep nesting ({a: ×5000, template, parens, JSX) overflows the native stack and kills Vite/LSP/MCP — depth limits with diagnostics in the scanner/masker and oxc passes, or a large-stack compile thread as backstop; M1 LUM4003 bypasses — register the plugin for workers, check new URL(literal, import.meta.url) in client environments + generateBundle backstop, match on realpath (case-insensitive FS, symlinks), cover non-node_modules files outside the Vite root; L5a CSS_REQUEST tested against the full id with query (use cleanId); decision-29: default envPrefix PUBLIC_ (overridable), server-only files in server.fs.deny for dev (overridable).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Depth limits/backstop with regression tests at depth 100k; LSP and MCP survive
- [ ] #2 LUM4003 bypass repros fail the build/dev request; envPrefix and fs.deny defaults with tests; docs (server.md, LUM4003.md, security.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (TASK-169, coordination): I registered LUM1009 (Content nested too deeply, lumen_content) and LUM3021 (Unsafe `$` constant value, lumen_css) in crates/lumen_compiler/src/diagnostics/registry.rs; I saw your LUM1010 line next to mine in the working tree. I commit only my two lines (temporary index from HEAD) and the LUM1009/LUM3021 error pages; LUM1010 and its page stay yours. No other lumen_compiler edits from me.

Photon (2026-10-09): part 1 (deep nesting): compile() rejects bracket nesting past 1000 levels with LUM1010 before parsing (light lexer over the masked text: (), [], {}, template ${}; strings/comments ignored); napi runs compile on a 256 MB-stack thread (reserved, not committed; panics become JS errors), which covers JSX element nesting (100k levels compile in ~0.2 s). Main-thread thresholds before: ~4.9k (objects/templates) to ~15k (blocks) levels on an 8 MB stack. Test packages/compiler/test/compile.test.ts at depth 100k for parens/objects/arrays/templates/blocks/JSX. Remaining: LUM4003 bypasses, envPrefix, fs.deny.

Photon — RESUME (checkpoint 2026-10-09, In Progress). Done: d784d8a depth guard (LUM1010 past 1000 bracket levels + napi 256 MB-stack compile thread; 100k tests; docs errors/LUM1010.md). 0b4fe45 (partial, green on existing tests, NO new tests yet): isServerOnly matches real paths, case-insensitive, packages outside the root (nearest package.json, lumen itself exempt), cleanId + STYLE_QUERY for the CSS exemption (?raw/?url of server files now count), dev load hook without id filter, transform check of new URL("…", import.meta.url) in client code, generateBundle backstop for emitted assets. Next: regression tests for each bypass (symlink, case, ../outside-root package, ?raw, new URL, worker); register serverOnlyPlugin({ worker: true }) in worker.plugins via the config hook (wrap the user's worker.plugins); decision-29 defaults in the lumen plugin config hook: envPrefix "PUBLIC_" unless set, server.fs.deny = Vite defaults ['.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}','.npmrc','.yarnrc.yml','**/.git/**'] + '**/*.server.*', '**/src/server/**' unless the user sets deny (ssr env skips fs checks, so SSR still loads them); tests; docs server.md, LUM4003.md, security.md. LSP/MCP survive via the napi thread (compileDiagnostics).
<!-- SECTION:NOTES:END -->
