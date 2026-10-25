---
id: decision-85
title: >-
  Scoped styles: attribute or class strategy, specificity and namespace
  (scopedStyles)
date: '2026-10-25 00:28'
status: accepted
---
## Context

Decision-12 fixed one way to scope `<style>` blocks. Elements get a `data-l-<hash>` attribute, and the last compound of every selector gets a (0,1,0) bump through `[data-l-<hash>]`. After the TASK-571 spike, the user asked on 2026-10-25 for both Vite plugins, `lumiose()` and `@lumiose/stsx`'s `stsx()` (decision-86), to let apps choose the scoping selector, as Astro's `scopedStyleStrategy` does. They also asked to choose its specificity and its name prefix. The user approved the option shape and its names in the same session (AskUserQuestion).

A class strategy also makes class passthrough possible outside Lumiose's runtime: a scope class can ride along in the `className`/`class` a parent passes to a child component (decision-86).

## Decision

**Option.** `lumiose()` and `stsx()` take the same option:

```ts
scopedStyles?: {
  /** How elements are marked. Default "attribute". */
  strategy?: "attribute" | "class";
  /** "default": the scope adds (0,1,0); "zero": the scope adds nothing (`:where()`). Default "default". */
  specificity?: "default" | "zero";
  /** The start of the scope attribute or class name. Default "lum". */
  namespace?: string;
};
```

| strategy | specificity | Element | Selector |
|---|---|---|---|
| `attribute` (default) | `default` | `data-lum-a1b2c3d4=""` | `.note[data-lum-a1b2c3d4]` |
| `attribute` | `zero` | `data-lum-a1b2c3d4=""` | `.note:where([data-lum-a1b2c3d4])` |
| `class` | `default` | `class="… lum-a1b2c3d4"` | `.note.lum-a1b2c3d4` |
| `class` | `zero` | `class="… lum-a1b2c3d4"` | `.note:where(.lum-a1b2c3d4)` |

**Rules**
- **Name.** The hash stays in the name: `data-<namespace>-<hash>` or `<namespace>-<hash>`. As today, an element can carry several scopes (a file scope and a component scope) as separate attributes or classes.
- **Specificity.** It describes what the scope adds to a selector. The selector's own specificity is unchanged. With `"zero"`, a scoped `.note` ties with a global `.note`, and source order decides between them.
- **Namespace.** It must start with a lowercase letter and contain only lowercase letters, digits and hyphens. An invalid value is a configuration error at startup.
- **Unchanged.** Placement (decision-14), `:global()`, `:deep()`, scoped `@keyframes` and pseudo-element placement keep their meaning under every strategy.
- **Class passthrough** (decision-12) works with both strategies in Lumiose apps. The runtime applies the caller's tokens as attributes or classes.
- **Default output changes.** The default namespace `lum` replaces today's `data-l-` with `data-lum-`, so the default output changes in Lumiose apps.

## Consequences

- **Implementation reaches several areas.** The CSS crate (selector rewriting per strategy and specificity), the compiler (stamping attributes, or merging classes into static and dynamic `class` values, on the client and the server) and both runtimes (`applyScope` and the server's attribute writer) all change. The contract (doc-2 §1, §5.3) is updated with them.
- **The class strategy must not collide with runtime classes.** `setClass` already removes only the classes it added itself, so scope classes survive dynamic `class` values. The server writer must merge scope classes into a single `class` attribute.
- **Selector matching that cannot see the strategy.** Anything that matches scope tokens without knowing the strategy must read the configured names: tests, snapshots, e2e assertions and docs that hard-code `data-l-`.
- **Specificity "zero".** It changes how scoped and global rules of equal specificity resolve. The styles concept page documents both modes.
- **Amends decision-12.** Decision-12's fixed `data-l-<hash>` attribute and its (0,1,0) bump become the defaults of this option, the bump unchanged and the attribute renamed to `data-lum-<hash>`.
- **Work.** TASK-572 (CSS crate), TASK-573 (compiler), TASK-574 (runtimes), TASK-575 (contract and spec) and TASK-576 (the `lumiose()` option and docs), in milestone M14.
