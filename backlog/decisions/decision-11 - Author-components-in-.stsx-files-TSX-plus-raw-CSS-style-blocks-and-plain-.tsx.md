---
id: decision-11
title: >-
  Author components in .stsx files (TSX plus raw CSS style blocks) and plain
  .tsx
date: '2026-10-08 10:56'
status: accepted
---
## Context

Supersedes decision-1.

The user rejected writing CSS inside JS tagged templates (`<style>{css`…`}</style>`) and wants styles to be truly first-class: plain CSS in `<style>` blocks, as in Svelte, Vue or Astro. JSX text cannot contain CSS braces, so this cannot be valid `.tsx`. The user's original requirements accept a new extension, provided it comes with a language server and syntax support.

## Decision

**File types**
- **`.stsx` ("styled TSX")** is the primary component format: a TSX module plus one or more top-level `<style>` blocks containing plain CSS.
- **`.tsx`** files are also compiled as Lumen components. They have no `<style>` blocks and can import `.css` files. Use them for style-less components and for interop.
- Non-UI logic stays in `.ts`.

**Masking invariant (must hold).** Replacing every top-level `<style>…</style>` block in a `.stsx` file with whitespace, keeping newlines, yields valid TSX with identical offsets. The only exception is constant references inside CSS (decision-12), which are kept in place as expression statements. Every tool integration relies on this invariant.

**Type checking**
- Lumen generates shadow `*.stsx.tsx` files from the masked source into `.lumen/shadow/`, and joins them to the source tree with `rootDirs`.
- Stock TS 7 `tsc` then checks the project, with no TypeScript API or plugins.
- Diagnostics map back to the `.stsx` file at the same line and column.
- Imports of `./X.stsx` resolve to the shadow `X.stsx.tsx`.

**Editor**
- The Lumen VS Code extension registers the `stsx` language and provides a grammar: TSX with embedded CSS in `<style>` blocks.
- The Lumen language server proxies TypeScript 7's native language server for the masked TSX, with positions mapped one to one. It runs a CSS language service on the style blocks.
- Cross-language features: class-name completion in JSX taken from the styles, go-to-definition, rename, and diagnostics for unused or unknown classes.

**Lint and format**
- `lumen lint` and `lumen fmt` run oxlint and oxfmt on the masked TSX and on the CSS separately.
- ESLint is supported through a processor, and Prettier through a plugin.

**Build.** The Vite plugin handles `.stsx` and `.tsx`.

## Consequences

- Styles are written as real CSS with full CSS tooling, and the TSX part keeps TS 7, oxlint and oxfmt compatibility through masking.
- Tools that don't know `.stsx` (bare oxlint or oxfmt, GitHub's Linguist) need the Lumen wrappers, or a `.gitattributes` mapping such as `*.stsx linguist-language=TSX`.
- Shadow files must stay fresh. The dev server, the language server and `lumen check` regenerate them.
- Agents need the AGENTS.md hint that `.stsx` is TSX plus `<style>` blocks. `lumen check` covers the rest.
- Revisit the shadow-file approach when the TS 7.1 API ships; it may allow in-memory virtual files.

