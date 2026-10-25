---
id: TASK-592
title: 'Proposal: .sjsx, STSX for JavaScript (naming, scope and cost)'
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-25 04:05'
updated_date: '2026-10-25 04:13'
labels:
  - proposal
  - stsx
dependencies: []
priority: low
ordinal: 584000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposal requested by the user on 2026-10-25; not approved for implementation. A new file format is a syntax and DX decision: the user decides the name, the scope and whether to do it at all (AGENTS.md).

**What.** `.sjsx`: STSX for JavaScript. A `.sjsx` file is JSX plus raw-CSS `<style>` blocks, with the same placement scoping, `$name` constants, `:global()`/`:deep()`, keyframes and `scopedStyles` as `.stsx`, parsed as JavaScript instead of TypeScript.

**Today.** Plain `.jsx` files work (the compiler reads them as JSX; raw CSS in a `<style>` is LUM1006), but `.stsx` is TypeScript only, and no part of the toolchain knows `.sjsx`. Lumiose's route files are TypeScript only too (`page.stsx`/`page.tsx`, `route.ts`; packages/lumiose/src/app/routes/segments.ts).

**Naming question.** "SJSX" reads naturally as "Styled JSX", which is the name of Vercel's styled-jsx library (`<style jsx>` blocks, built into Next.js's Pages Router). Options:
1. `.sjsx`, called "Styled JSX" like STSX's "Styled TSX": symmetric, but it collides with styled-jsx in search results and in conversation.
2. `.sjsx`, called "STSX for JavaScript" (never "Styled JSX"): the format keeps one name, STSX, with a TypeScript and a JavaScript extension.
3. No new extension: document that a `.stsx` file can hold untyped code (TypeScript accepts JavaScript), with type checking optional. It costs only docs, but JavaScript projects then run TypeScript tooling (shadows, `noImplicitAny` errors under a strict tsconfig).

**Suggested scope.** `@lumiose/stsx` first, where JavaScript React and Solid apps are common. Lumiose itself second, if at all: it would also need JavaScript route files, a separate decision for a framework whose components are TSX (decision-1, decision-11).

**What it takes, by area** (from the places that hard-wire `.stsx` today):
- **Compiler** (crates/lumiose_compiler; Photon). A file kind for `.sjsx` in scanner/mod.rs (FileKind::from_path), parsed with oxc's `SourceType::jsx()` in compile.rs `source_type` and in prepare/constants.rs; `compileTsx` emits JSX for it, or a sibling output; module ids, dev source locations (dev_source.rs) and diagnostics name the file as written; napi and wasm entry points accept it; scanner, golden and fuzz fixtures cover it.
- **@lumiose/stsx** (Photon). Virtual ids `X.sjsx.jsx` and `X.sjsx.css`, so framework plugins' `.[jt]sx?` filters still accept them; resolveId, load, transform, the dev URL rewrite, the dependency scanner, the React Router route-module guard, the fs.allow check (TASK-588) and HMR for both extensions; the `classAttribute` option is unchanged.
- **@lumiose/vite** (Photon, Nova for app/**; only with Lumiose support). Its module filters and style modules (index.ts, styles.ts, css-manifest.ts, client-scripts.ts, server-only.ts), the dev plugin and chunk names, the shadow layout (layout.ts), and route discovery if JavaScript routes are accepted.
- **Type checking.** `stsx typegen` and Lumiose's typegen write `X.sjsx.jsx` shadows; `tsc` checks them only with `allowJs` (and `checkJs` for errors); the `rootDirs` setup stays the same. The `$name` reference check in shadows works for JavaScript too.
- **Language server** (Beacon). Document selector and file kinds (server.ts, workspace.ts, stsx-mode.ts, providers.ts, project-styles.ts): JavaScript language features through the `.sjsx.jsx` shadows, CSS features in blocks, class names between JSX and blocks.
- **VS Code extension** (Beacon). A second language (`sjsx`, extension `.sjsx`) in package.json, and a grammar like syntaxes/stsx.tmLanguage.json that embeds `source.js.jsx` instead of `source.tsx`, generated from one source; tokenizer snapshot tests; the README.
- **Formatting** (Beacon). `lumiose fmt` (cli/src/fmt) formats each part through oxfmt with a `.jsx` name for the code; `@lumiose/prettier-plugin` gets an `sjsx` parser on Babel; `@lumiose/eslint-plugin`'s processor and `lumiose lint` accept the extension.
- **CLI and MCP** (Beacon). `lumiose check` (shadow.ts, tsconfig.ts, project-checks.ts), the MCP source tools and the agent guidance, if Lumiose supports it.
- **Docs** (Beacon). The STSX docs (installation, a JavaScript section, type checking with `allowJs`), the examples (a JavaScript React example), the site's STSX section and llms.txt, and the Lumiose styles page if Lumiose supports it.

**Rough size.** For `@lumiose/stsx` only (compiler, plugin, language server, VS Code, fmt, docs): about 5 tasks of the size of M14's TASK-577 to TASK-583. Adding Lumiose with JavaScript routes roughly doubles it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user chose a name (Styled JSX, STSX for JavaScript, or no new extension) and a scope (@lumiose/stsx only, or Lumiose too), or declined the proposal
- [x] #2 If approved, the work is recorded as a decision and split into tasks per owner area (compiler, @lumiose/stsx, language server and VS Code, fmt and lint, docs)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): naming chosen by the user: option 1. `.sjsx` is Styled JSX, the counterpart of Styled TSX ("STSX for JS is misleading"), accepting the overlap with Vercel's styled-jsx. Still open: the scope (@lumiose/stsx only, or Lumiose too) and the go-ahead to implement.

2026-10-25 (Lux): scope chosen by the user: @lumiose/stsx and Lumiose, including JavaScript route files. Recorded as decision-88; the work is M15: TASK-593 (compiler), TASK-594 (@lumiose/stsx), TASK-595 (@lumiose/vite modules), TASK-596 (JavaScript route files), TASK-597 (language server and VS Code), TASK-598 (fmt and lint), TASK-599 (CLI, MCP, agent guidance), TASK-600 (docs and examples). Not implemented yet, at the user's request.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Proposal resolved: .sjsx is Styled JSX, in @lumiose/stsx and Lumiose with JavaScript route files (decision-88). Work planned as M15, TASK-593 to TASK-600.
<!-- SECTION:FINAL_SUMMARY:END -->
