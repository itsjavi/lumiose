---
id: TASK-48
title: Language server follow-ups
status: Done
assignee:
  - Beacon
created_date: '2026-10-08 14:03'
updated_date: '2026-10-08 16:03'
labels:
  - tooling
dependencies:
  - TASK-29
priority: low
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Gaps found while implementing TASK-29 (packages/language-server). (1) Import syncShadows/shadowPathFor from a lumen package export (e.g. lumen/check; packages/lumen/package.json is Lux-owned) instead of the relative import in packages/language-server/src/shadows.ts. (2) Wire the compiler's compile() diagnostics (once @lumen/compiler exposes it) through ServerOptions.diagnosticProviders in src/bin.ts. (3) Restart the TS 7 LSP after a crash (today: error message, CSS/Lumen features keep working). (4) Cross-file class features: offer/define classes from <style global> blocks of other files (e.g. root _layout.stsx). (5) Merge CSS document symbols into TS symbols for .stsx; execution-contract hovers (spec §9.2). (6) Optionally filter TS window/logMessage verbosity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Language server imports the shadow API from a lumen package export
- [x] #2 Compiler diagnostics flow into .stsx diagnostics with a protocol test
- [x] #3 TS LSP crash recovery covered by a test
- [x] #4 <style global> classes of other workspace files are offered in class completion and resolved by go-to-definition, with a protocol test
- [x] #5 CSS document symbols for style blocks are merged into TypeScript's document symbols, with a protocol test
- [x] #6 Execution-contract hovers implemented, or the needed compile() meta shape proposed to Lux when meta lacks per-expression tracking
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. LSP crash recovery: supervise the TS 7 child; on unexpected exit restart with exponential backoff (cap + max attempts), re-initialize, re-open synced documents, refresh diagnostics.
2. Compiler diagnostics: a compile()-based DiagnosticProvider (target client) in the language server, debounced per open .stsx/.tsx document, UTF-16 spans mapped to LSP positions; wire into src/bin.ts and into lumen check via the existing DiagnosticProvider hook.
3. Cross-file global classes: index <style global> classes across workspace .stsx files for completion/definition.
4. CSS document symbols for .stsx merged with TS symbols.
5. Execution-contract hovers only if compile() meta exposes per-expression tracking; else propose a meta shape to Lux.
6. Protocol tests over stdio for each; pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-08, during TASK-30): AC #1 done: packages/language-server/src/shadows.ts imports from the lumen/tooling export (dependency lumen: workspace:*); LS suite 32/32.

Beacon (2026-10-08, TASK-48):
- Compiler diagnostics: shared core compileDiagnostics() in packages/lumen/src/cli/check/compile.ts (exported via lumen/tooling): client compile(), drops LUM1001 (TypeScript reports syntax errors) and diagnostics already in the scan. lumen check runs it as a built-in DiagnosticProvider (compilerDiagnostics: every .stsx plus src/**/*.tsx), so main.ts is untouched. LS: src/providers.ts wraps it as a LumenDiagnosticProvider, wired in src/bin.ts; providers now also run for .tsx documents, at most once per document version (pull: client debounce; push: 200 ms server debounce); their fixes become quick fixes. LumenFile gained root.
- Duplicate rule: LUM3008 on a $ref that holds a TypeScript error start is dropped (unknown name: TS2304/2552 'Did you mean' is the actionable one), in both check (dropSuperseded) and the LS (withoutSuperseded); SUPERSEDED_BY_TYPESCRIPT exported from lumen/tooling.
- Crash recovery: the TS process is supervised (exit/error); on an unexpected exit after initialize it restarts with backoff 0.5/1/2/4/8 s (counter resets after 60 s of uptime), re-sends initialize/initialized and didOpen for every open document (masked text for .stsx, current unsaved versions), then refreshes diagnostics/semantic tokens/inlay hints; gives up with an error message after 5 failed restarts. Requests in flight during a crash answer null; notifications to a closed connection are swallowed. Startup log now includes the tsc pid.
- Cross-file classes: src/globals.ts GlobalClassIndex of <style global> selector classes per file, fed by syncShadows at startup/watched changes (disk) and by open buffers (snapshots); completion detail 'global style, <file>:<line>', definition returns Locations/LocationLinks into other files. Rename/references stay file-local.
- CSS document symbols: one Namespace symbol per block (named by its open tag, detail global/component/file) with vscode-css-languageservice symbols as children, nested into the innermost TS symbol (component blocks under their component); flat SymbolInformation fallback.
- Execution-contract hovers NOT implemented: compile() meta has no per-expression tracking. Proposed meta (to Lux): CompileOptions.contract?: boolean (opt-in); CompileMeta.contract?: Array<{ span: Span; kind: 'tracked'|'untracked'|'once'|'deferred'; site: 'child'|'attribute'|'property'|'class'|'style'|'prop'|'event'|'ref'|'spread'|'await'; component?: string; via?: string /* runtime helper, e.g. insert, effect(setAttribute), getter prop */; reads?: Span[] /* reactive reads that make it tracked */ }>. The LS would hover the innermost entry containing the cursor.
- Docs: compiler.md, getting-started.md, vscode README updated; routing.md example 2 fixed (now flagged LUM2001 by check: derived title is a function); llms regenerated.
- Not done (optional item 6): filtering TS window/logMessage verbosity.
- Validation: LS suite 36/36 (3 reruns stable; new: compiler diagnostics .stsx/.tsx, global classes, document symbols, crash recovery via SIGKILL of tsc); lumen check suite 14/14 (new compiler-diagnostics test); pnpm typecheck OK; pnpm lint: no warnings in my files; pnpm test 784/785, the 1 failure is docs examples LUM5005 in docs/reference/app.md example 1 from Nova's in-progress static-endpoint rule (TASK-26), not this task. VS Code bundle builds with the new server code.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Language server follow-ups: compiler (compile()) diagnostics in the LS for .stsx/.tsx and in lumen check via a shared provider; TS 7 crash recovery with backoff and document re-sync; <style global> classes across files for completion/definition; CSS document symbols merged into the outline. Execution-contract hovers need compile() meta (shape proposed to Lux). Tests over stdio for each; check/LS suites green.
<!-- SECTION:FINAL_SUMMARY:END -->
