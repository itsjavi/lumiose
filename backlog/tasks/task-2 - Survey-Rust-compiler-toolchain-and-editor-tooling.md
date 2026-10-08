---
id: TASK-2
title: Survey Rust compiler toolchain and editor tooling
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 09:59'
updated_date: '2026-10-08 10:19'
labels: []
milestone: m-0
dependencies: []
priority: high
type: spike
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Lumen compiler must be Rust-based, components are valid TSX with a <style>{css`...`}</style> element, and TypeScript 7 is first-class. TS 7.0 has no stable programmatic API yet, so editor support for CSS inside TSX, typing of the style element, and lint/format compatibility must be designed around what the toolchain actually supports today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compares OXC and SWC for a custom JSX/TSX transform (AST access, transformer API, napi/wasm, Rolldown/Vite 8 integration) with a recommendation
- [x] #2 Evaluates Lightning CSS for scoping, nesting, minification and native @scope output, including current browser baseline for @scope
- [x] #3 Describes how to deliver CSS highlighting/completions/diagnostics inside css tagged templates in .tsx under TS 7 (TextMate injection, VS Code virtual documents, TS 7 LSP limits)
- [x] #4 Confirms oxlint, oxfmt and TS 7 handle the authoring format, and how JSX types (jsxImportSource, IntrinsicElements) are configured
- [ ] #5 Findings are recorded in the task notes and referenced by the architecture spec
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started by Lux as orchestrator; research delegated to a Photon subagent (research-only, returns findings).

Research by Photon (a subagent, research only), recorded by Lux. Experiments are kept in `.local/agents/Photon/` (exp1 oxfmt, exp2 Lightning CSS, exp3 TS 7.0.2 JSX typing).

## Findings (as of 2026-10-08)

**OXC vs SWC.** Recommendation: OXC.
- Versions: `oxc_*` 0.153 (pre-1.0, frequent breaking changes), rolldown 1.2.13, vite 8.3.3, lightningcss crate 1.0.0-alpha.72, napi 3.14.
- Vite 8 already uses OXC for TS/JSX and Lightning CSS for CSS minification.
- Neither Rolldown nor Vite can load third-party Rust plugins, only built-ins. The supported path is a JS plugin calling a napi addon. Rolldown hook filters run on the Rust side, and a `pre` plugin sees raw TSX.
- Evan You estimates an out-of-core Rust plugin is about 50% slower than in-core because of data passing; raw AST transfer is a long-term goal.
- The official Solid compiler (`@dom-expressions/compiler`, MIT, napi-rs v3 + wasm32-wasi fallback, dom/ssr/hydratable generators) is OXC-based. Its building blocks are `oxc_ast_visit` VisitMut + AstBuilder + `oxc_semantic` + `oxc_codegen`, without `oxc_traverse`.
- SWC only wins for Next/Rspack targets.
- Mitigate OXC churn by pinning exact versions (Vize pins a git rev) and keeping a golden-fixture suite.

**Prior art.**
- `ryansolid/dom-expressions` (`next` branch, `packages/compiler`) is the best reference for template cloning, SSR strings, delegation and hydration.
- `yumemi-thomas/solid-1x-compiler` (OXC, MIT) emits an "execution contract" trace (tracked, untracked, once or deferred per expression), which is useful for LSP and agent tooling.
- Vize (`ubugeeei/vize`) is a Rust Vue toolchain on pinned OXC + lightningcss + napi + wasm + tower-lsp. It is a structural reference.
- Ripple (`@tsrx/core`) is JS-based and uses its own format.
- `chatium/jsx-dom-expressions-swc` has no license, so it can't be reused.

**Lightning CSS** (verified with 1.33).
- CSS-modules mode, nesting lowering, minify and source maps work.
- Visitors rewrite selectors correctly, including inside `@media`.
- `:global()`, `:deep()` and `:slotted()` parse as custom-function pseudos with raw tokens, which must be re-parsed.
- `ParserOptions` has no line/column offset: pad the extracted CSS or compose source maps.
- `@scope` is not lowered.

**Native `@scope`.** Chrome 118, Safari 17.4, Firefox 146 (Dec 2025). Baseline "newly available" since Dec 2025, "widely available" around 2028. Donut scoping excludes slot/children content passed from a parent, so it is wrong as the default.

**Editor support under TS 7.**
- TS 7.0 has no API. The 7.1 plan (microsoft/TypeScript#63703) is Beta 10-06, RC 11-10, Stable 11-24 with Content Mapper, Emit and Language Service APIs, and no tsserver plugin model.
- tsserver plugins (styled-components, lit-plugin) are not loaded under TS 7.
- VS Code's options are embedding `vscode-css-languageservice` in our own LSP, or request forwarding, which has no diagnostics.
- Recommended: a TextMate injection grammar for `css` templates plus a standalone Node LSP (`vscode-languageserver` + `vscode-css-languageservice`) that masks `${}` into virtual CSS and also emits compiler diagnostics. The same diagnostics go through `lumen check`.

**JSX typing (verified on TS 7.0.2).**
- `jsx: preserve` + `jsxImportSource` resolves JSX from `<source>/jsx-runtime`.
- `<style>` can be typed as `{ children: Stylesheet; global?: true }`. A string child, `global={false}`, two children or a `media` attribute all fail type checking, and `className` is rejected when only `class` is declared.
- `on${Capitalize<keyof HTMLElementEventMap>}` gives typed events. Namespaced attributes (`on:click`, `bind:value`, `client:load`) are type-checkable as string keys.
- Caveat: SVG `<style>` must be handled by the compiler.

**oxfmt and oxlint.**
- oxfmt 0.72 formats CSS inside `css` tagged templates in TSX, including inside `<style>{css`...`}</style>`. Only the `css` tag name triggers formatting. Stdin mode skips embedded CSS. Prettier also formats `css` tags.
- oxlint JS plugins (alpha) support ESLint v9-compatible custom rules with autofix, but no custom parsers or type-aware rules. Ship `eslint-plugin-lumen-jsx` for both oxlint and ESLint.

**Names (npm and crates.io, checked today).**
- Taken: npm `lumen`, `create-lumen` (React+Vite scaffolder), `lumen-framework`, `lumen-ui`, `lumen-js`; crates `lumen`, `lumen-compiler` ("AI-Native Programming Language", 2026-10-04, a confusion risk).
- Free: npm `lumen-jsx`, `lumenjs`, `@lumen-jsx/core`; crates `lumen-jsx`, `lumen_jsx`.
- `@lumen` scope ownership is unknown.
- Confusion risks: Laravel Lumen, Ledger's Lumen design system, UE5 Lumen.
- Photon recommends standardising on `lumen-jsx` / `@lumen-jsx/*`.

## Orchestrator resolutions (Lux)
- **Toolchain:** OXC (exact pins, VisitMut + AstBuilder + semantic + codegen), Lightning CSS (pinned), napi-rs v3 + wasm fallback, and a Vite/Rolldown JS plugin with Rust-side hook filters.
- **Style output:** per-element `data-l-<hash>` attribute scoping by default; native `@scope` is a later opt-in.
- **Specificity:** keep the Vue/Svelte (0,1,0) bump on the last compound rather than `:where()`. Code-split CSS load order is not predictable, so scoped rules must reliably beat global element selectors.
- **Scope unit:** the module (file). Every template in the file shares one hash, which covers helper components and JSX-returning helpers. Dynamic `${}` vars bind per instance on the root element(s) of the component that contains the `<style>`.
- **`<style global>`:** only compile-time-constant interpolations; dynamic ones are a compile error.
- **dom-expressions compiler:** reference it and selectively reuse code and fixtures with MIT attribution. Don't fork it, because Lumen's runtime contract (styles, islands, compiled `.map`, props destructuring) diverges.
- **Events:** `onX` is delegated for bubbling events and `on:x` attaches a native listener. `class` accepts string, array or object, compiled clsx-style.
- **Naming:** escalated to the user as an open question in the spec; `lumen-jsx` is the working package name.

## Sources
https://oxc.rs/docs/guide/usage/transformer/plugins · https://vite.dev/guide/migration · https://rolldown.rs/builtin-plugins · https://rolldown.rs/apis/plugin-api/hook-filters · https://socket.dev/blog/rolldown-pulls-rust-react-compiler-integration · https://blog.swc.rs/2025-11-4-wasm-backward-compatibility · https://github.com/ryansolid/dom-expressions/tree/next/packages/compiler · https://github.com/yumemi-thomas/solid-1x-compiler · https://github.com/ubugeeei/vize · https://github.com/trueadm/ripple · https://blog.master.dev/how-to-scope-css-now-that-its-baseline/ · https://web.dev/blog/web-platform-12-2025 · https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ · https://github.com/microsoft/TypeScript/issues/63703 · https://github.com/microsoft/typescript-go/issues/3848 · https://code.visualstudio.com/api/language-extensions/embedded-languages · https://oxc.rs/docs/guide/usage/formatter/embedded-formatting · https://oxc.rs/docs/guide/usage/linter/js-plugins · https://napi.rs/docs/concepts/webassembly
<!-- SECTION:NOTES:END -->
