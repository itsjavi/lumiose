---
id: decision-14
title: 'Style scope follows placement: component, file, global'
date: '2026-10-08 11:34'
status: accepted
---
## Context

This decision amends decision-11 and decision-12. As originally written, decision-12 allowed `<style>` blocks only at the top level of a `.stsx` file and scoped them to the whole file.

The user asked whether a raw `<style>` (no template tags) could live inside a component. They approved the rule that placement decides scope (2026-10-08). The motivation is a `.stsx` file that exports several components, each of which needs its own scoped styles.

## Decision

**Placement decides scope.** A `<style>` block applies to exactly what encloses it.

| Placement | Scope |
|---|---|
| Inside a component's JSX | That component only. Its own templates get a per-component scope token. |
| Top level of the `.stsx` file | Every template in the file. |
| `<style global>`, either placement | The whole app, unscoped. |

**Content.** Every `<style>` element in a `.stsx` file holds raw CSS, wherever it sits, the way HTML treats `<style>` as a raw-text element. The compiler extracts it at build time, so placement has no runtime cost.

**Constraints on component-level blocks:**
- The block must be a static direct child in the JSX tree. A block inside a conditional, inside `.map()`, or inside any `{…}` expression is a compile error, because CSS is static. Use classes for variation.
- A `<style>` block cannot be the only thing a component returns.

**`$name` references** (decision-12) keep meaning build-time constants only. Inside a component, local `const` bindings with statically evaluable values are allowed. Signals and props are an error.

**Masking for tooling** (amends decision-11's invariant):
- A top-level block is masked to whitespace. Its constant references become `;expr` expression statements.
- A block inside JSX is masked to whitespace, which JSX accepts as text. Its constant references become `{expr}` expression containers at the same offsets: the `$` turns into `{`, and the character after the reference turns into `}`.
- Either way, positions stay identical and TypeScript still type-checks constant references.

**Class passthrough** (decision-12) carries the enclosing scope tokens of the parent. For a component-level block, that is the component's token.

## Consequences

- A single `.stsx` file can hold several components, each with its own private styles. Svelte and Vue can't do this, because there a file is a component.
- The scope hierarchy gives authors three levels, and agents need only one rule: "styles apply to what encloses them."
- The compiler must track which templates belong to which component in order to stamp per-component tokens.
- Diagnostics are needed for misplaced `<style>` blocks, such as conditional ones or a block used as the sole root.


_Clarified in spec v0.3 §4.1 (technical refinement, decision-16): a component-level block may sit at any depth of the static JSX, but its parent must be an intrinsic element or fragment, not a component element (LUM3010). Top-level blocks must come after the constants they reference (LUM3013). Masking uses the first non-newline character after a reference._
