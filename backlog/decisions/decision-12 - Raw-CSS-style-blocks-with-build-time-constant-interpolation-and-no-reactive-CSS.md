---
id: decision-12
title: >-
  Raw CSS style blocks with build-time constant interpolation and no reactive
  CSS
date: '2026-10-08 10:56'
status: accepted
---
## Context

Supersedes decision-2. The scoping, global and extraction parts of decision-2 carry over. Its `css` tagged template and reactive `${}` interpolation are dropped.

The user wants plain CSS. They need to reuse JS constants such as design tokens and breakpoints inside CSS, but they do not need reactive values in CSS.

## Decision

**Blocks**
- `<style>` blocks sit at the top level of `.stsx` files (decision-11).
- They are scoped to the file. Each element in the file's templates gets a `data-l-<hash>` attribute, and the last compound of every selector gets a (0,1,0) specificity bump.
- `<style global>` emits a block unscoped. `:global()` and `:deep()` remain as escapes.
- `@keyframes` names are scoped.
- Lightning CSS lowers nesting and handles targets and minification.
- CSS is extracted into static assets through Vite. There is no CSS runtime.

**Class passthrough.** When a parent passes `class` to a component, the parent's scope token also lands on the child's root element (Vue-style). Parent styles therefore apply to `<Child class="x">`.

**Build-time constants**
- CSS can reference JS constants in property values and in at-rule conditions (`@media`, `@container`, `@supports`). It cannot reference them in selectors or property names.
- **Eligible values:**
  - top-level `const` bindings in the file;
  - `export const` imports from `.ts`, `.tsx` or `.stsx` modules;
  - and only when the value is statically evaluable: literals, template literals of constants, members of `as const` objects and arrays, and simple arithmetic.
- The value is inlined at build time.
- Anything else is a compile error with a suggested fix.
- References appear in the shadow TSX at their exact positions, so TypeScript provides hover, go-to-definition, rename and unused-import tracking.

**Interpolation syntax: pending the user's choice.** `const()` was rejected because CSS could standardise a function with that name; Safari once shipped `constant()`. Candidates:
- `$name` (Sass-like; recommended);
- `--const(name)` (dashed functions are author space under the CSS spec);
- a vendor-style prefix such as `-l-const(name)`.

**No reactive CSS.** CSS contains no JS expressions. Per-instance dynamic values use the ordinary JSX `style` prop with custom properties (`style={{ "--x": value }}` with `var(--x)` in CSS). The compiler gives that prop fine-grained updates, and it is not a separate feature.

## Consequences

- The compiler needs no per-instance CSS-variable machinery tied to `<style>`. The CSP concern shrinks to inline `style` attributes in general.
- Breakpoints and tokens can be shared between JS and CSS, including in media queries.
- Constant folding across modules requires the compiler to parse imported modules. Edits to those modules must invalidate the dependent CSS during HMR.

