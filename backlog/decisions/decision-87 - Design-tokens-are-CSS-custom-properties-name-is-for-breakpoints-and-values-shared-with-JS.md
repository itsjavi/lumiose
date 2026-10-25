---
id: decision-87
title: >-
  Design tokens are CSS custom properties; $name is for breakpoints and values
  shared with JS
date: '2026-10-25 02:12'
status: accepted
---
## Context

Decision-12 added `$name`: a JS constant folded into a style block at build time. The docs, the examples, the landing sample and the agent guidance then used it as the default home of a design system: a `tokens.ts` module with colors, radii and spacing, read as `$brand.primary` in every block.

On 2026-10-25 the user pointed out that this works against CSS custom properties. A value folded at build time cannot change at runtime: no themes, no dark mode, no section that overrides a few values through the cascade. It is also invisible in devtools and unknown to global stylesheets, third-party CSS and `@lumiose/ui`'s `--lu-` properties, and changing it needs a rebuild. The user asked for `$name` to be the exception, kept for values that JS code also needs. This decision records that guidance.

## Decision

**Design tokens are CSS custom properties.** Colors, spacing, radii, typography, shadows and other design values are declared as custom properties, on `:root` in a global stylesheet or a `<style global>` block, and read with `var(--name)` in style blocks. Themes and dark mode override them with selectors or media queries. Values that change per instance at runtime go through the `style` prop (`style={{ "--progress": … }}`), as before.

**`$name` is for what custom properties cannot do, or for what JS also needs:**
- **Conditions.** Breakpoints and other conditions of `@media`, `@container` and `@supports`, where `var()` does not work.
- **Values shared with JS code:**
  - a breakpoint that `matchMedia` also reads;
  - grid columns that a virtualizer also computes with;
  - durations that a timer also waits for;
  - colors that a canvas or chart also draws with, or that color math in JS derives.

**Typed custom property names (amended 2026-10-25, the user's choice).** A project that wants typo checks, or JS access to its custom properties, keeps their names in an `as const` module and reads them with `var($vars.name)`:

```ts
// vars.ts
export const vars = { brand: "--brand", radius: "--radius" } as const;
```

```css
.card { color: var($vars.brand); border-radius: var($vars.radius, 8px); }
```

- **The name, not `var()`.** The string is the bare name (`"--brand"`), not `"var(--brand)"`. The same string reads the value in CSS (`var($vars.brand)`, fallbacks included) and sets or reads it in JS (`style={{ [vars.brand]: c }}`, `el.style.setProperty(vars.brand, c)`, `getComputedStyle(el).getPropertyValue(vars.brand)`). `var()` also stays visible in the style block, which keeps this decision's line clear: a bare `$x` is fixed at build time, `var($x)` is resolved at runtime.
- **What it checks.** A mistyped member (`var($vars.brnd)`) fails the build with LUM3008. The declarations that set the values (`:root { --brand: … }`) still spell out the names, since `$` does not substitute in a declaration's name, so a typo there is not caught.
- **Optional.** Plain `var(--brand)` needs no module and works in any stylesheet; the docs teach it first and present the names module as the pattern for typo checks and JS access. The module holds names only: the values stay in CSS.

**Applies to** the Lumiose docs (the styles concept page), the STSX docs and the `@lumiose/stsx` README, the examples (vite-counter and the stsx examples), the landing page sample, and the agent guidance that `lumiose agents init` writes. The `$name` reference itself (rules, errors, folding) stays documented in full, presented as the exception.

**Unchanged:**
- The test fixtures of the compiler, CLI and language server keep their `tokens.ts`: they test `$name` itself.
- @lumiose/site-kit keeps its palette in TypeScript (it checks contrast and generates the theme's custom properties). Reading `var(--…)` in its components instead of `$color.*` is a separate, optional change.

## Consequences

- **What new users learn.** The first examples teach custom properties, which theme and cascade, and `$name` where it earns its place. Agents follow the same rule.
- **Less constant folding.** `calc()` with `var()` is resolved by the browser. That is not a cost worth avoiding for design values.
- **No change to `$name`.** Its compiler support and diagnostics stay as they are; `var($vars.name)` already works.
- **Possible follow-up.** Allowing `$` in declaration names (`:root { $vars.brand: #7c3aed; }`) would check the definitions too. It is a syntax change and needs the user's approval first.
- **Work:** TASK-586.
