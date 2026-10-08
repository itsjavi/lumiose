---
id: decision-6
title: >-
  TypeScript 7 policy: no TS plugins; editor features via TextMate injection +
  Lumen LSP
date: '2026-10-08 10:28'
status: proposed
---
## Context

TypeScript 7.0, the native Go port released July 2026, ships no programmatic API, and it does not load tsserver plugins. The 7.1 API is planned for stable release around November 2026. Its Content Mapper, Emit and Language Service APIs do not include a plugin model.

Tools that rely on TS plugins are stuck on TS 6 today. Examples are styled-components IntelliSense and lit-plugin. Vue, Svelte and Astro template checking is stuck on TS 6 for the same reason. Lumen requires TS 7 as a first-class citizen.

## Decision

- **Codebase.** The Lumen codebase is written and checked with TS 7.
- **User projects.** User projects need only stock TS 7 `tsc` and its native language service, with JSX types supplied via `jsxImportSource: "lumen-jsx"`.
- **No TypeScript plugins.** Lumen never depends on a TS language-service plugin.
- **Editor features for CSS and compiler diagnostics** come from three parts:
  - a VS Code extension with a TextMate injection grammar for `css` tagged templates;
  - `@lumen-jsx/language-server`, a standalone Node LSP using `vscode-css-languageservice` over whitespace-masked virtual CSS, which also reports Lumen compiler diagnostics;
  - `lumen check`, which combines `tsc`, compiler diagnostics and lint, with JSON output.
- **Type-aware checks.** Checks that need type information, such as whether island props are serializable, run at runtime in development and through best-effort static analysis. They will be reassessed once the TS 7.1 API ships.

## Consequences

- No Lumen tooling is blocked by TypeScript's API roadmap.
- The LSP works in any LSP-capable editor.
- CSS IntelliSense is weaker than a full TS plugin would give. For example, it cannot type-check `${}` values against CSS property types.
- Revisit this decision when TS 7.x exposes a stable API that would allow deeper integration.

