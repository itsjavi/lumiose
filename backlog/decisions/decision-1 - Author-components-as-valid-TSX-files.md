---
id: decision-1
title: Author components as valid TSX files
date: '2026-10-08 09:59'
status: superseded by decision-11
---
## Context

Lumen wants first-class styles in components (like Svelte, Vue and Astro) while staying TypeScript 7-first, compatible with existing tooling, and easy for coding agents to read and write.

Single-file formats (`.svelte`, `.vue`, `.astro`) need their own language server, formatter and lint integrations. They typically get type checking through Volar, which depends on the TypeScript JS API. TypeScript 7.0 (July 2026) ships no stable programmatic or plugin API; it is expected in 7.1. A custom extension would therefore pin editor and type-check support to the TS 6 bridge for an unknown period.

Alternatives considered:
- A new `.lumen` single-file format with Astro-style frontmatter and raw `<style>` blocks. It reads best, but has the highest tooling cost and is blocked on the TS 7 API.
- A TSX superset extension where `<style>` contains raw CSS. It has the same tooling cost, because TSX parsers reject raw CSS braces.

## Decision

Every Lumen component is a valid `.tsx` (or `.jsx`) module. The Lumen compiler transforms standard TSX syntax. Lumen-specific behaviour is expressed only through constructs that TSX already parses: JSX elements, attributes, namespaced attributes (`client:visible`, `bind:value`) and tagged templates (`css`).

Styles live in a `<style>` element whose child is a `css` tagged template. This is required because JSX text cannot contain CSS braces. See decision-2.

## Consequences

- TS 7 `tsc` and its native language service, oxlint, oxfmt, Prettier, Vitest and agents work on Lumen code with no plugins. Types come from `jsxImportSource: "lumen"`.
- The Lumen editor extension only adds CSS language features inside `css` templates and compiler diagnostics. It never replaces TypeScript's language service.
- Some ergonomics are lost compared to raw `<style>` blocks: CSS is written inside a template literal.
- Lumen-specific semantics, such as compiled `.map()`, reactive props destructuring and `css` interpolation rules, are invisible to TypeScript. They must be enforced by compiler diagnostics and `lumen check`.
- Revisit only if TS 7.1+ ships a stable API that makes a custom format cheap and there is a strong ergonomic reason.

