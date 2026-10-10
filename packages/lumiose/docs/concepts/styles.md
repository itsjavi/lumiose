# Styles

> Write plain CSS in `<style>` blocks in `.stsx` files. Where a block sits decides its scope: the element that encloses it, the file, or the whole app with `<style global>`. CSS reads JS constants as `$name`, inlined at build time, and constant math is precomputed.

## Concept

**Placement decides scope.**

| Placement                                                                            | Scope                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside a component's JSX, as a child of an intrinsic element or fragment (any depth) | Its **enclosing element and everything written inside it** in that component, including `.map` callbacks and JSX passed as children there. A block directly under the component's root element therefore covers the whole component. Sibling subtrees are not affected, and it never reaches other components' own templates. |
| File top level (conventionally at the end of the file)                               | Every template in the file.                                                                                                                                                                                                                                                                                                   |
| `<style global>` (anywhere a block is valid)                                         | The whole app, unscoped. Usually in the root `_layout.stsx`.                                                                                                                                                                                                                                                                  |

```stsx
export function Panel() {
  return (
    <div class="panel">
      <aside class="side">…</aside>                 {/* not styled by the <style> below */}
      <section class="body">
        <p class="note">…</p>
        <style> .note { color: tomato; } </style>  {/* only this <section> subtree */}
      </section>
      <style> .panel { display: grid; } </style>   {/* the whole component */}
    </div>
  );
}
```

**How scoping works.** Each scope with styles gets a token `data-l-<hash>`, a stable hash of the
file path plus the component name, with one token per style-bearing element. Every element in the
scope carries the token: the whole file for top-level blocks, and the enclosing element's lexical
subtree for blocks inside a component. The last compound of each selector gets `[data-l-<hash>]`,
a +0,1,0 specificity bump. Dynamic classes always work, because no element is pruned.

- `:global(.sel)` leaves a selector unscoped; `:deep(.sel)` scopes only the part before it.
- `@keyframes` names are scoped, and `animation` references are rewritten. A block sees its own
  keyframes, then those of the blocks of enclosing elements (innermost first), then the file's, so
  a nested block can animate with keyframes defined under the component's root. Custom properties
  are not scoped.
- **Class passthrough.** When a parent passes `class` to a child component, the parent's scope
  tokens at that call site travel with it: the file token plus every enclosing style subtree. So
  `.cta { … }` in the parent styles `<Button class="cta" />` wherever `Button` applies
  `props.class`. The child applies it on every element whose `class` value may contain it:
  `class={["btn", props.class]}`, a destructured `class` prop or `...rest`, a helper that gets
  `props` (`class={variantClass(props)}`), or a local value or function built from them
  (`const classes = () => ["btn", props.class]`). A class that reaches the element any other way
  (a module-level variable, a context) loses the parent's scope, so read `props.class` in the
  component. Forwarding works through intermediate components: when `Field` passes its own
  `class` prop on (`<Input class={["field", props.class]} />`), `Input`'s element gets `Field`'s
  tokens and those of `Field`'s caller.
- Within a file, file-level CSS comes first, then component blocks in source order.
- **In the editor**, class completion follows the same scopes: in a `class` attribute it offers
  the classes of the blocks that apply there (innermost first), then the project's global classes
  (`<style global>` blocks and imported global `.css` files), never a sibling subtree's.
  `var(--…)` offers every custom property declared in the project, with its value.

**Blocks are plain CSS:** no Sass, no `lang`, `media` or other attributes (only `global`). CSS
imports, CSS Modules, Tailwind v4 and `.scss` imports still work through Vite.

> **Status:** available. `@lumiose/vite` serves each file's CSS as a CSS module, and style-only or
> constant-only edits hot-update the CSS without remounting. `LUM3012` (a custom property set in a
> `style` prop that no stylesheet reads) is reported by `lumiose build` only.

**In builds**, a page needs few render-blocking stylesheets. `lumiose build` merges the stylesheets
every page starts with (the document's, the root layouts', shared components') into one file that
all pages link and browsers cache, then puts each page's own stylesheets after it: inline in one
`<style>` when they total 4 kB or less, else merged into one file for that page. The cascade
order is the same as in dev, where each file's CSS stays a separate stylesheet for HMR. In the
sample apps a first view went from 6–8 stylesheet requests to one, with about 30% fewer CSS bytes (brotli).
Each tag lists the stylesheets it holds in `data-l-css`, so an island or an SPA route that imports
one does not load it again.

### JS values in styles

`$name` and `$obj.key` put a JS value into CSS. The compiler evaluates the reference at build time
and inlines the result, so the output is plain CSS: no runtime lookup and no JS inside CSS.
TypeScript checks each reference like any other expression. Imports used only by `$` references
are removed from the JS output, and editing them hot-reloads the CSS only.

**What a reference can name:** a `const` whose value the compiler can work out without running the
app.

| Declared as                                                                                  | Readable from                                                                                                    |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A top-level `const` of the file                                                              | Every block of the file. A top-level block must come after it.                                                   |
| A `const` of the enclosing component                                                         | Blocks inside that component, `<style global>` included.                                                         |
| An `export const` (or `export default`) of an imported `.ts`, `.tsx`, `.stsx` or JSON module | Every block of the importing file: named, default or namespace imports (`$theme.space.md`), re-exports included. |

Imports are resolved the way the rest of the toolchain resolves them: by Vite in `lumiose dev` and
builds (aliases included), and like TypeScript in `lumiose check` and the editor (relative paths,
tsconfig `paths`, package `exports` and `imports`). An import that cannot be resolved, or that has
no such export, is reported as [LUM3008](../errors/LUM3008.md) at each reference.

The value may be built from literals, template literals, arithmetic (`+ - * / % **`, unary `-`),
other constants, and object literals with their members at any depth (`$theme.color.brand`),
including spreads, destructuring, `as const` and `satisfies`. Mark token objects `as const`: a plain
object literal folds too, as written, but only `as const` keeps the JS read-only like the CSS.

**How values are written.** Strings are inserted verbatim, without quotes (`"12px"` becomes
`12px`; for a CSS string, put the quotes inside: `'"→"'`). Numbers are inserted as plain numbers
(`const gap = 8` gives `8`), so give them a unit with `calc($gap * 1px)` (which ships as `8px`, see below) or keep the unit in the
constant (`"8px"`, `` `${gap}px` ``). A bare number where a length, angle or time is required
(`gap: $gap`, `rotate: $angle`) is [LUM3018](../errors/LUM3018.md), with `calc($gap * 1px)` as the
fix: Lightning CSS happens to read a bare length as pixels, but angles and times are dropped, and in
custom properties or math functions the number stays unitless. A unit written after the reference
(`$gap px`) does not attach to it ([LUM3019](../errors/LUM3019.md)).

**What cannot be referenced.** The compiler reports it; the CSS keeps the `$` text, which browsers
ignore.

| Reference                                                                                                   | Diagnostic                      | Fix                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `$space(2)`: a function call, or a `const` holding a function or a call's result (`Date.now()`, `signal()`) | [LUM3008](../errors/LUM3008.md) | Compute it as a constant: `calc($space * 2px)` with `const space = 4`, or name the steps: `$space.md`. |
| `$count` where `count` is a `let` (or `var`)                                                                | [LUM3008](../errors/LUM3008.md) | Make it a `const`, or pass it at runtime (below).                                                      |
| `$open`, `$props.width`: signals, props, parameters                                                         | [LUM3008](../errors/LUM3008.md) | Pass it at runtime (below).                                                                            |
| `$sizes.0`: an array item (`sizes.0` is not JS)                                                             | [LUM3008](../errors/LUM3008.md) | An `as const` object with named keys: `$sizes.sm`.                                                     |
| `$brand-primary`: a hyphen, read as `$brand` minus `primary`                                                | [LUM3009](../errors/LUM3009.md) | `$brand.primary`, or a camelCase constant: `$brandPrimary`.                                            |
| A component's `const` in a block outside it (file level, or another component)                              | [LUM3008](../errors/LUM3008.md) | Move the `const` to the top level, or the block into the component.                                    |
| A top-level block above the `const` it reads                                                                | [LUM3013](../errors/LUM3013.md) | Move the block below it; by convention, to the end of the file.                                        |

`LUM3008`'s message says which case it is (a `let` binding, computed by a call at runtime, an array,
not declared in scope, an import that does not export the name, …).

**Where `$` is read:** in property values (`gap: calc($gap * 1px)`) and in `@media`, `@container`
and `@supports` preludes (`@media (width < $narrow)`). Everywhere else `$` is left to CSS:

- In selectors, `$` keeps its CSS meaning: `[href$=".pdf"]` is "ends with". `.size-$md` is not a
  reference but an invalid selector, which Lightning CSS drops (`LUM3015`).
- Property names, strings (`content: "$gap"`), comments and `url($file)` are not substituted. Put
  the whole value in the constant instead: `const hero = 'url("/hero.png")'` and
  `background-image: $hero`.

**Runtime values.** A `$` reference is fixed at build time. For a value that changes (a signal, a
prop, a measurement), set a custom property with the `style` prop and read it with `var()`. Custom
properties are not scoped and inherit, so descendants can read them too.

```stsx
<div class="bar" style={{ "--fill": `${pct()}%` }}>
  <style>
    .bar { inline-size: var(--fill); }
  </style>
</div>
```

Tokens usually live in their own module:

```ts check file=theme.ts
// src/theme.ts
export const space = { sm: 4, md: 8, lg: 16 } as const;
export const radius = "6px";
export const narrow = "40rem";
```

```stsx check file=components/Meter.stsx
// src/components/Meter.stsx
import * as theme from "../theme.ts";

const track = theme.space.sm * 2;
const shadow = `0 1px ${track / 4}px rgb(0 0 0 / 0.2)`;

export function Meter(props: { label: string; value: number }) {
  const border = 1;

  return (
    <div class="meter" style={{ "--value": `${props.value}%` }}>
      <span>{props.label}</span>
      <div class="track">
        <div class="fill" />
      </div>

      <style>
        .meter {
          --pad: calc($theme.space.md * 2px);
          display: grid;
          gap: calc($theme.space.sm * 1px);
          padding: var(--pad);
          border: calc($border * 1px) solid;
          border-radius: $theme.radius;
        }
        .track { block-size: calc($track * 1px); border-radius: calc($track * 1px / 2); box-shadow: $shadow; }
        .fill { inline-size: var(--value); block-size: 100%; background: currentColor; }
        @media (width < $theme.narrow) {
          .meter { max-inline-size: calc(100% - $theme.space.lg * 2px); }
        }
      </style>
    </div>
  );
}
```

The compiler's CSS output for that file (`data-l-lw1tegds` is the component's scope token). Every
`$` reference and every constant `calc()` is gone; only the runtime `var(--value)` and the
`%`-relative width are left to the browser:

```css
.meter[data-l-lw1tegds] {
  --pad: 16px;
  padding: var(--pad);
  border: 1px solid;
  border-radius: 6px;
  gap: 4px;
  display: grid;
}

.track[data-l-lw1tegds] {
  border-radius: 4px;
  block-size: 8px;
  box-shadow: 0 1px 2px #0003;
}

.fill[data-l-lw1tegds] {
  inline-size: var(--value);
  background: currentColor;
  block-size: 100%;
}

@media (width < 40rem) {
  .meter[data-l-lw1tegds] {
    max-inline-size: calc(100% - 32px);
  }
}
```

Lightning CSS also minifies values (`rgb(0 0 0 / 0.2)` becomes `#0003`) and may reorder or merge
declarations, so the output is equivalent to the source, not identical.

#### Build-time math

Constant math never reaches the browser. It is computed in two steps:

1. **JS math, by the Lumiose compiler.** Arithmetic in constants and template literals is evaluated
   before the value is inserted: `const track = theme.space.sm * 2` inlines `8`.
2. **CSS math, by Lightning CSS.** After substitution, Lightning CSS reduces `calc()`, `min()`,
   `max()`, `clamp()`, `round()`, `abs()`, the trigonometric functions and the other CSS math
   functions whenever the operands are concrete values in compatible units. `calc($gap * 2px)`
   becomes `calc(8 * 2px)`, which ships as `16px`.

| Source (`$gap` is `8`)                    | Output                                | Why                                            |
| ----------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| `padding: calc($gap * 2px)`               | `padding: 16px`                       | `calc(8 * 2px)` reduces.                       |
| `inline-size: min(10px, 20px)`            | `inline-size: 10px`                   |                                                |
| `block-size: clamp(4px, 8px, 12px)`       | `block-size: 8px`                     |                                                |
| `transform: rotate(calc(45deg * 2))`      | `transform: rotate(90deg)`            | Math inside other functions reduces too.       |
| `inset: calc(2px + 3px) calc(1rem + 4px)` | `inset: 5px calc(1rem + 4px)`         | Each value on its own: `rem` plus `px` stays.  |
| `width: calc(100% - $gap * 2px)`          | `width: calc(100% - 16px)`            | The constant part reduces; `%` stays.          |
| `font-size: calc(2 * 1rem)`               | `font-size: 2rem`                     | One unit: nothing to convert.                  |
| `font-size: clamp(1rem, 2vw, 3rem)`       | unchanged                             | `rem` and `vw` are only known in the browser.  |
| `max-width: calc(var(--w) + $gap * 2px)`  | `max-width: calc(var(--w) + 8 * 2px)` | A declaration with `var()` is kept as written. |
| `--space: calc($gap * 2px)`               | `--space: 16px`                       | A custom property, folded by Lumiose (below).  |
| `padding-left: calc($gap * 1px - 12px)`   | `padding-left: 0`                     | Negative in a non-negative property (below).   |
| `margin-left: calc($gap * 1px - 12px)`    | `margin-left: -4px`                   | Margins can be negative.                       |

**What cannot fold.** A math function is replaced only by a value that means the same thing
wherever it is used. Absolute units convert into each other (`calc(1in + 4px)` is `100px`) and a
unit combines with itself (`calc(2 * 1rem)` is `2rem`), but context-dependent units mixed with
others need the browser: `%` resolves against the containing block (or the font size, depending on
the property), `vw` and `vh` against the viewport, `em` against the element's font size and `rem`
against the root's. A `var()` is only known when the browser computes styles, so Lightning CSS keeps
any declaration containing one exactly as written, constant parts included. To precompute those,
do the arithmetic in JS: with `` const extra = `${gap * 2}px` ``, `calc(var(--w) + $extra)` ships as
`calc(var(--w) + 16px)`.

**Custom properties.** Lightning CSS keeps custom property values as written, because it cannot
know where they will be used. Lumiose folds each math function in them that reduces to a single value
in compatible units: `--space: calc($gap * 2px)` becomes `16px`, `--turn: rotate(calc(45deg * 2))`
becomes `rotate(90deg)`, and `var(--x, calc($gap * 3px))` becomes `var(--x, 24px)`. Anything with
`var()`, `env()` or context-dependent units mixed with other units stays whole, without the partial
reduction regular properties get (`--inset: calc(100% - $gap * 2px)` stays `calc(100% - 8 * 2px)`).
Negative results and fractional numbers stay inside `calc()` (`calc(-3px)`, `calc(.333333)`),
because a bare value can behave differently where the property is read: `calc()` clamps to the
property's range and rounds where an integer is expected.

**Negative results.** Some properties cannot be negative: padding, sizes (`width`, `min-height`,
…), border widths, `gap`, `font-size`, `line-height` and others. In the browser, a `calc()` that
comes out negative there is clamped to 0, while a negative value written out is invalid and the
whole declaration is dropped. So that folding does not change the meaning, a negative result in such
a property ships as `0`: `padding-left: calc($gap * 1px - 12px)` gives `padding-left: 0`, and
`font-size: calc(1rem - 2rem)` gives `font-size: 0`. This mirrors the upstream Lightning CSS fix
([lightningcss#1329](https://github.com/parcel-bundler/lightningcss/pull/1329)), which Lumiose
applies until a release includes it. Properties that accept negative values, such as margins and
`inset`, keep them.

Folding regular properties, minification and browser targets come from
[Lightning CSS](https://lightningcss.dev), the CSS parser, transformer and minifier from the Parcel
project, which Lumiose's CSS compiler is built on. Lumiose adds `$` constants, scoping and the
custom-property folding.

## API

| Syntax                                   | Meaning                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `<style>…</style>` in component JSX      | CSS scoped to its enclosing element's subtree (the whole component when placed under the root element).  |
| `<style>…</style>` at module top level   | File-scoped CSS. Must come after the `const`s it references.                                             |
| `<style global>…</style>`                | Unscoped, app-wide CSS.                                                                                  |
| `$name`, `$obj.key`                      | A JS constant, inlined at build time, in property values and `@media`/`@container`/`@supports` preludes. |
| `calc()`, `min()`, `max()`, `clamp()`, … | Folded at build time when every operand is a concrete value in compatible units.                         |
| `:global(sel)`, `:deep(sel)`             | Escape or extend the scope.                                                                              |
| `style={{ "--x": value }}` + `var(--x)`  | Runtime values.                                                                                          |

## Example

```stsx check
// tokens are usually in their own module: `export const radius = { sm: "4px", lg: "12px" } as const;`
const radius = { sm: "4px", lg: "12px" } as const;
const BREAKPOINT = "40rem";

export function Card(props: { title: string; progress: number; class?: string }) {
  const gap = 12;

  return (
    <article class={["card", props.class]} style={{ "--progress": `${props.progress}%` }}>
      <h2>{props.title}</h2>
      <div class="bar" />

      <style>
        .card { display: grid; gap: calc($gap * 1px); border-radius: $radius.lg; }
        .bar { inline-size: var(--progress); block-size: 4px; background: currentColor; }
        @media (width < $BREAKPOINT) { .card { border-radius: $radius.sm; } }
      </style>
    </article>
  );
}

export function Dashboard() {
  return (
    <main>
      <Card class="featured" title="Uploads" progress={40} />

      <style>
        .featured { outline: 2px solid gold; }
      </style>
    </main>
  );
}

<style>
  h2 { margin: 0; }
</style>
```

`.featured` in `Dashboard` reaches the `<article>` inside `Card` through class passthrough; `h2`
in the file-level block styles every template in the file.

## Common mistakes

- **A block inside `{…}`, a conditional, a `.map` callback, or a component element** such as
  `<Suspense>` or `<Card>`. Move it into an intrinsic element of the component (`LUM3010`).
- **Returning a block, or using it as an expression** (`return <style>…`, `=> <style>`). Put it
  inside the returned element (`LUM3011`).
- **Hyphenated references.** `$brand-primary` reads `$brand` minus `primary`. Use an object
  member: `$brand.primary` (`LUM3009`).
- **Non-constant references.** `$count` where `count` is a signal, a prop or a `let`, or a call
  such as `$space(2)`, is `LUM3008`. Pass runtime values with `style={{ "--count": count() }}` and
  `var(--count)`; replace calls with constant math (`calc($space * 2px)`).
- **Array items.** `$sizes.0` is not JS (`LUM3008`). Use an `as const` object: `$sizes.sm`.
- **A unit after a reference.** `margin: $gap px` ships as `8 px`, which browsers ignore
  (`LUM3019`). Write `calc($gap * 1px)` or keep the unit in the constant.
- **A unitless number in a length, angle or time.** `gap: $gap` with `const gap = 8` relies on
  Lightning CSS reading `8` as pixels, and `rotate: $angle` is dropped (`LUM3018`). Multiply by the
  unit (`calc($angle * 1deg)`) or keep the unit in the constant.
- **`$` in selectors, strings or `url()`.** It is not substituted there (`[href$=".pdf"]` is CSS's
  "ends with"). Put the whole value in a constant, `url()` included.
- **A top-level block before the `const`s it reads.** Move the block to the end of the file
  (`LUM3013`).
- **`<style>` in a `.tsx` file.** It is a type error in `.tsx` (and `LUM1006` for raw CSS); rename the file to `.stsx`.
- **Attributes on `<style>`.** Only `global` is allowed (`LUM1005`).
- **Expecting a parent's styles to reach into children.** Scopes stop at component boundaries;
  pass `class` (passthrough) or use `:deep()`.
- **Expecting a nested block to style sibling subtrees.** A `<style>` inside an element only
  styles that element's subtree. Move it up to the common ancestor, or under the component's root
  element, to cover more.
- **Styling JSX returned by a helper function.** In `const field = () => <label class="field">…`
  inside a component, the helper's JSX is not inside the element that holds a nested `<style>`, so
  `.field` matches nothing there (`LUM3005`). Move the block to the top level of the file (it
  styles every element of the file), or render that JSX inside the styled element.

## Related diagnostics

- [LUM1004](../errors/LUM1004.md), [LUM1005](../errors/LUM1005.md), [LUM1006](../errors/LUM1006.md): unclosed block, unknown attribute, raw CSS in `.tsx`.
- [LUM3005](../errors/LUM3005.md): unused scoped selector.
- [LUM3008](../errors/LUM3008.md), [LUM3009](../errors/LUM3009.md), [LUM3013](../errors/LUM3013.md): `$` reference problems.
- [LUM3010](../errors/LUM3010.md), [LUM3011](../errors/LUM3011.md): misplaced blocks.
- [LUM3012](../errors/LUM3012.md): custom property set but never read.
- [LUM3014](../errors/LUM3014.md), [LUM3015](../errors/LUM3015.md): CSS syntax error, invalid CSS dropped (such as `$` in a selector).
- [LUM3017](../errors/LUM3017.md): a declaration value browsers would ignore, or no value.
- [LUM3020](../errors/LUM3020.md): an unknown property name, with a fix for close typos.
- [LUM3018](../errors/LUM3018.md), [LUM3019](../errors/LUM3019.md): a unitless `$` number, a unit separated from a reference.

See also: [Components](components.md), [JSX `style` and `class`](jsx.md).
