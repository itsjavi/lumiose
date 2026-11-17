# Style blocks

> How `<style>` blocks are scoped, the `scopedStyles` option, typed token names, what a `$` reference can name, build-time math, and the stylesheets a build writes.

The rules behind [Styles](../concepts/styles.md), which introduces them with examples. Imported
stylesheets, CSS Modules and Tailwind have a guide:
[Stylesheets, CSS Modules and Tailwind](../guides/stylesheets.md).

## How scoping works

Each scope with styles gets a token, a stable hash of the file path plus
the component name, with one token per style-bearing element. Every element in the scope carries
the token as a marker, `data-lum-<hash>` by default: the whole file for top-level blocks, and the
enclosing element's lexical subtree for blocks inside a component. The last compound of each
selector gets `[data-lum-<hash>]`, a +0,1,0 specificity bump. Dynamic classes always work, because
no element is pruned. `scopedStyles` changes the marker and the bump (see [scopedStyles](#scopedstyles)).

- `:global(.sel)` leaves a selector unscoped; `:deep(.sel)` scopes only the part before it.
- `@keyframes` names are scoped, and `animation` references are rewritten. A block sees its own
  keyframes, then those of the blocks of enclosing elements (innermost first), then the file's, so
  a nested block can animate with keyframes defined under the component's root. Custom properties
  are not scoped.
- Within a file, file-level CSS comes first, then component blocks in source order.
- **In the editor**, class completion follows the same scopes: in a `class` attribute it offers
  the classes of the blocks that apply there (innermost first), then the project's global classes
  (`<style global>` blocks and imported global `.css` files), never a sibling subtree's.
  `var(--…)` offers every custom property declared in the project, with its value.

### Class passthrough

When a parent passes `class` to a child component, the parent's scope
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

## scopedStyles

One app-wide option of `lumiose()` decides how elements carry their scope and how scoped selectors
match it (decision-85).

```ts
lumiose({
  scopedStyles: {
    strategy: "attribute", // or "class"
    specificity: "default", // or "zero"
    namespace: "lum", // the start of the marker name
  },
});
```

| `strategy`            | `specificity` | Element                     | `.note` becomes                    |
| --------------------- | ------------- | --------------------------- | ---------------------------------- |
| `attribute` (default) | `default`     | `data-lum-a1b2c3d4`         | `.note[data-lum-a1b2c3d4]`         |
| `attribute`           | `zero`        | `data-lum-a1b2c3d4`         | `.note:where([data-lum-a1b2c3d4])` |
| `class`               | `default`     | `class="note lum-a1b2c3d4"` | `.note.lum-a1b2c3d4`               |
| `class`               | `zero`        | `class="note lum-a1b2c3d4"` | `.note:where(.lum-a1b2c3d4)`       |

- **`strategy: "class"`** puts the marker in the element's `class`, next to its own classes, on the
  client and in server-rendered HTML. Class handling never removes it. Pick it when attributes
  get in the way, for example when HTML is post-processed by a tool that strips `data-*`.
- **`specificity: "zero"`** wraps the marker in `:where()`, so the scope adds nothing: a scoped
  `.note` ties with a global `.note`, and the one that comes later wins. Pick it when global styles
  or utility classes should override component styles without `!important`. It needs `:where()`
  support (every evergreen browser).
- **`namespace`** starts with a lowercase letter and holds lowercase letters, digits and hyphens.
  Change it to avoid clashes with another library's markers.
- Class passthrough, `:global()`, `:deep()`, `@keyframes` scoping and placement work the same in
  every combination.

## Typed token names

Design tokens are custom properties declared on `:root`
([Design tokens](../concepts/styles.md#design-tokens)). To catch a mistyped name, and to use the
same names from JS, keep them in an `as const` module and read them with `var($vars.name)`. The
module holds the names only; the values stay in CSS.

`var($vars.accent)` ships as `var(--accent)`, and `var($vars.radius, 4px)` keeps its fallback. A
mistyped member (`$vars.acent`) fails the build with [LUM3008](../errors/LUM3008.md), and
TypeScript checks the JS side (`style={{ [vars.accent]: … }}`, `getPropertyValue(vars.accent)`).
The declarations on `:root` still spell the names out, because `$` is not read in a property
name. Plain `var(--accent)` needs no module: the names module is worth it when a project wants
those checks.

```ts check file=vars.ts
// src/vars.ts
export const vars = {
  accent: "--accent",
  surface: "--surface",
  radius: "--radius",
  space: "--space",
} as const;
```

```stsx check file=components/Chip.stsx
// src/components/Chip.stsx
import { vars } from "../vars.ts";

export function Chip(props: { label: string; color: string }) {
  return (
    <span class="chip" style={{ [vars.accent]: props.color }}>
      {props.label}
    </span>
  );
}

<style>
  .chip {
    padding: calc(var($vars.space) / 2) var($vars.space);
    border-radius: var($vars.radius, 4px);
    background: var($vars.surface);
    color: var($vars.accent);
  }
</style>
```

## JS values in styles

`$name` and `$obj.key` put a JS value into CSS. The compiler evaluates the reference at build
time and inlines the result, so the output is plain CSS: no runtime lookup and no JS inside CSS.
TypeScript checks each reference like any other expression. Imports used only by `$` references
are removed from the JS output, and editing them hot-reloads the CSS only.

### When to use `$name`

A custom property is resolved by the browser, which is what design
tokens need. A `$` constant is fixed at build time: keep it for what custom properties cannot do,
and for values that JS code also needs:

- **Conditions** of `@media`, `@container` and `@supports`, where `var()` does not work: a
  breakpoint (`@media (width < $narrow)`).
- **Values shared with JS:** the breakpoint that `matchMedia` also checks, the grid columns that a
  virtualizer also computes with, a duration that a timer also waits for, a color that a canvas
  draws with or that JS color math derives.

### What a reference can name

A `const` whose value the compiler can work out without running the app.

| Declared as                                                                                  | Readable from                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A top-level `const` of the file                                                              | Every block of the file. A top-level block must come after it.                                                |
| A `const` of the enclosing component                                                         | Blocks inside that component, `<style global>` included.                                                      |
| An `export const` (or `export default`) of an imported `.ts`, `.tsx`, `.stsx` or JSON module | Every block of the importing file: named, default or namespace imports (`$scale.ticks`), re-exports included. |

Imports are resolved the way the rest of the toolchain resolves them: by Vite in `lumiose dev` and
builds (aliases included), and like TypeScript in `lumiose check` and the editor (relative paths,
tsconfig `paths`, package `exports` and `imports`). An import that cannot be resolved, or that has
no such export, is reported as [LUM3008](../errors/LUM3008.md) at each reference.

The value may be built from literals, template literals, arithmetic (`+ - * / % **`, unary `-`),
other constants, and object literals with their members at any depth (`$chart.series.sales`),
including spreads, destructuring, `as const` and `satisfies`. Mark constant objects `as const`: a plain
object literal folds too, as written, but only `as const` keeps the JS read-only like the CSS.

### How values are written

Strings are inserted verbatim, without quotes (`"12px"` becomes
`12px`; for a CSS string, put the quotes inside: `'"→"'`). Numbers are inserted as plain numbers
(`const gap = 8` gives `8`), so give them a unit with `calc($gap * 1px)` (which ships as `8px`, see [Build-time math](#build-time-math)) or keep the unit in the
constant (`"8px"`, `` `${gap}px` ``). A bare number where a length, angle or time is required
(`gap: $gap`, `rotate: $angle`) is [LUM3018](../errors/LUM3018.md), with `calc($gap * 1px)` as the
fix: Lightning CSS happens to read a bare length as pixels, but angles and times are dropped, and in
custom properties or math functions the number stays unitless. A unit written after the reference
(`$gap px`) does not attach to it ([LUM3019](../errors/LUM3019.md)).

### What cannot be referenced

The compiler reports it; the CSS keeps the `$` text, which browsers ignore. "Pass it at runtime"
means a custom property set with the `style` prop
([Runtime values](../concepts/styles.md#runtime-values)).

| Reference                                                                                                   | Diagnostic                      | Fix                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `$space(2)`: a function call, or a `const` holding a function or a call's result (`Date.now()`, `signal()`) | [LUM3008](../errors/LUM3008.md) | Compute it as a constant: `calc($space * 2px)` with `const space = 4`, or name the steps: `$space.md`. |
| `$count` where `count` is a `let` (or `var`)                                                                | [LUM3008](../errors/LUM3008.md) | Make it a `const`, or pass it at runtime.                                                              |
| `$open`, `$props.width`: signals, props, parameters                                                         | [LUM3008](../errors/LUM3008.md) | Pass it at runtime.                                                                                    |
| `$sizes.0`: an array item (`sizes.0` is not JS)                                                             | [LUM3008](../errors/LUM3008.md) | An `as const` object with named keys: `$sizes.sm`.                                                     |
| `$brand-primary`: a hyphen, read as `$brand` minus `primary`                                                | [LUM3009](../errors/LUM3009.md) | `$brand.primary`, or a camelCase constant: `$brandPrimary`.                                            |
| A component's `const` in a block outside it (file level, or another component)                              | [LUM3008](../errors/LUM3008.md) | Move the `const` to the top level, or the block into the component.                                    |
| A top-level block above the `const` it reads                                                                | [LUM3013](../errors/LUM3013.md) | Move the block below it; by convention, to the end of the file.                                        |

`LUM3008`'s message says which case it is (a `let` binding, computed by a call at runtime, an array,
not declared in scope, an import that does not export the name, …).

### Where `$` is read

In property values (`gap: calc($gap * 1px)`) and in `@media`, `@container`
and `@supports` preludes (`@media (width < $narrow)`). Everywhere else `$` is left to CSS:

- In selectors, `$` keeps its CSS meaning: `[href$=".pdf"]` is "ends with". `.size-$md` is not a
  reference but an invalid selector, which Lightning CSS drops (`LUM3015`).
- Property names, strings (`content: "$gap"`), comments and `url($file)` are not substituted. Put
  the whole value in the constant instead: `const hero = 'url("/hero.png")'` and
  `background-image: $hero`.

## Values shared with JS

Values that the styles and the JS both use live in a module of their own, imported by the
components and the code that need them. Here the meter's `ticks` decide both the labels it renders
and the columns and marks of its CSS, and `narrow` is the breakpoint of its `@media` and of the
app's `matchMedia` check. Its design values are custom properties:

```ts check file=scale.ts
// src/scale.ts: read by the styles and by the JS.
export const ticks = 4;
export const narrow = "40rem";
export const isNarrow = () => matchMedia(`(width < ${narrow})`).matches;
```

```stsx check file=components/Meter.stsx
// src/components/Meter.stsx
import * as scale from "../scale.ts";

const step = 100 / scale.ticks;

export function Meter(props: { label: string; value: number }) {
  return (
    <div class="meter" style={{ "--value": `${props.value}%` }}>
      <span>{props.label}</span>
      <div class="track">
        <div class="fill" />
      </div>
      <ol class="scale">
        {Array.from({ length: scale.ticks }, (_, i) => (
          <li key={i}>{(i + 1) * step}%</li>
        ))}
      </ol>

      <style>
        .meter {
          display: grid;
          gap: var(--space);
          padding: calc(var(--space) * 2);
          border-radius: var(--radius);
          background: var(--surface);
        }
        .track {
          block-size: 8px;
          border-radius: 4px;
          background: repeating-linear-gradient(to right, transparent 0 calc($step * 1% - 1px), currentColor 0 calc($step * 1%));
          box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.2);
        }
        .fill { inline-size: var(--value); block-size: 100%; background: var(--accent); }
        .scale {
          display: grid;
          grid-template-columns: repeat($scale.ticks, 1fr);
          margin: 0;
          padding: 0;
          list-style: none;
          text-align: end;
        }
        @media (width < $scale.narrow) {
          .scale { display: none; }
        }
      </style>
    </div>
  );
}
```

The compiler's CSS output for that file (`data-lum-lw1tegds` is the component's scope token). Every
`$` reference and every constant `calc()` is gone; the `var()` reads, which the browser resolves,
and the `%`-relative stop are left as written:

```css
.meter[data-lum-lw1tegds] {
  gap: var(--space);
  padding: calc(var(--space) * 2);
  border-radius: var(--radius);
  background: var(--surface);
  display: grid;
}

.track[data-lum-lw1tegds] {
  background: repeating-linear-gradient(to right, #0000 0 calc(25% - 1px), currentColor 0 25%);
  border-radius: 4px;
  block-size: 8px;
  box-shadow: inset 0 1px 2px #0003;
}

.fill[data-lum-lw1tegds] {
  inline-size: var(--value);
  background: var(--accent);
  block-size: 100%;
}

.scale[data-lum-lw1tegds] {
  text-align: end;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
}

@media (width < 40rem) {
  .scale[data-lum-lw1tegds] {
    display: none;
  }
}
```

Lightning CSS also minifies values (`rgb(0 0 0 / 0.2)` becomes `#0003`) and may reorder or merge
declarations, so the output is equivalent to the source, not identical.

## Build-time math

Constant math never reaches the browser. It is computed in two steps:

1. **JS math, by the Lumiose compiler.** Arithmetic in constants and template literals is evaluated
   before the value is inserted: `const step = 100 / scale.ticks` inlines `25`.
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

### What cannot fold

A math function is replaced only by a value that means the same thing
wherever it is used. Absolute units convert into each other (`calc(1in + 4px)` is `100px`) and a
unit combines with itself (`calc(2 * 1rem)` is `2rem`), but context-dependent units mixed with
others need the browser: `%` resolves against the containing block (or the font size, depending on
the property), `vw` and `vh` against the viewport, `em` against the element's font size and `rem`
against the root's. A `var()` is only known when the browser computes styles, so Lightning CSS keeps
any declaration containing one exactly as written, constant parts included. To precompute those,
do the arithmetic in JS: with `` const extra = `${gap * 2}px` ``, `calc(var(--w) + $extra)` ships as
`calc(var(--w) + 16px)`.

### Folding in custom properties

Lightning CSS keeps custom property values as written, because it cannot
know where they will be used. Lumiose folds each math function in them that reduces to a single value
in compatible units: `--space: calc($gap * 2px)` becomes `16px`, `--turn: rotate(calc(45deg * 2))`
becomes `rotate(90deg)`, and `var(--x, calc($gap * 3px))` becomes `var(--x, 24px)`. Anything with
`var()`, `env()` or context-dependent units mixed with other units stays whole, without the partial
reduction regular properties get (`--inset: calc(100% - $gap * 2px)` stays `calc(100% - 8 * 2px)`).
Negative results and fractional numbers stay inside `calc()` (`calc(-3px)`, `calc(.333333)`),
because a bare value can behave differently where the property is read: `calc()` clamps to the
property's range and rounds where an integer is expected.

### Negative results

Some properties cannot be negative: padding, sizes (`width`, `min-height`,
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

## Browser targets

Production builds minify CSS for the [supported browsers](../stability.md#browsers), which all
have `:dir()`, nesting, `light-dark()` and the other modern syntax, so it ships as written. With an
older `build.cssTarget` (or `build.target`) in your Vite config, Lightning CSS lowers what those
browsers lack: `:dir(rtl)` becomes a list of `:lang()` selectors, which miss a `dir` attribute, and
`light-dark()` becomes variables that follow the system's colour scheme only, so a `color-scheme`
set on an element, inline or from a script no longer switches the colours.

## Build output

A page needs few render-blocking stylesheets. `lumiose build` groups each page's
stylesheets into at most three tags, in the page's cascade order:

1. A file with the stylesheets every page starts with (the document's, the root layouts', shared
   components'), linked by all pages and cached across them.
2. A file with the stylesheets a group of pages goes on with, such as a route group's layout and
   the components it renders, linked by those pages only. A group gets its file when three routes
   or more continue with the same stylesheets (routes with identical stylesheets count once) and
   they total more than 4 kB; a smaller run stays in each page's own CSS. So a page without the
   site chrome, such as a fullscreen editor outside the `(site)` group, no longer moves the
   chrome's CSS into every other page's file.
3. The page's own stylesheets: inline in one `<style>` when they total 4 kB or less, else merged
   into one file for that page.

The cascade order is the same as in dev, where each file's CSS stays a separate stylesheet for
HMR. In the sample apps a first view went from 6–8 stylesheet requests to one, with about 30%
fewer CSS bytes (brotli). On a 39-page site with one page outside its route group, a visit to
every page went from 12 requests and 29 kB to 8 requests and 15 kB.
A page that links a stylesheet also gets `<script>/* waits for the stylesheets above */</script>`
after its stylesheet tags (54 bytes, in dev too). The browser parses the body only once the
stylesheets before that script have loaded, so the body's first layout is styled. Without it,
Chrome could lay out the unstyled body when a scrolled page is reloaded, restore the scroll
position from that layout, and paint the first frames at the wrong place until `load`.
The first paint waits for the stylesheets either way. With `csp: "strict"` the script gets the
nonce or its hash (see [Security](../concepts/security.md)).
Each tag lists the stylesheets it holds in `data-l-css`, so an island or an SPA route that imports
one does not load it again. Pages link the CSS files the build output contains: when another Vite
plugin rewrites a stylesheet under a new name after Lumiose recorded it, the build follows it (by
the chunks that import it, the name it was emitted with, or the one new CSS file), and warns about
a linked stylesheet the output no longer has.

> **Status:** available. `@lumiose/vite` serves each file's CSS as a CSS module, and style-only or
> constant-only edits hot-update the CSS without remounting. `LUM3012` (a custom property set in a
> `style` prop that no stylesheet reads) needs the whole project: `lumiose build`, `lumiose check` and
> the language server report it.

## Common mistakes

- **A design system in `$` constants.** Colors, spacing and radii folded at build time cannot
  change with a theme, a media query or the cascade, and devtools do not show them. Declare them
  as custom properties on `:root` and read them with `var()`; keep `$` for breakpoints and values
  JS also uses (see [Design tokens](../concepts/styles.md#design-tokens)).
- **`"var(--brand)"` in a names module.** Store the bare name (`brand: "--brand"`) and write
  `var($vars.brand)`: the same string then works in JS (`style={{ [vars.brand]: … }}`), and
  fallbacks work (`var($vars.brand, #000)`).
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
- **Expecting a parent's styles to reach into children from another file.** A file's blocks
  never style the templates of components defined in other files; pass `class` (passthrough) or
  use `:deep()`.
- **Expecting a nested block to style sibling subtrees.** A `<style>` inside an element only
  styles that element's subtree. Move its rules to the file-level block at the end of the file,
  or the block up to the common ancestor.
- **Styling JSX returned by a helper function.** In `const field = () => <label class="field">…`
  inside a component, the helper's JSX is not inside the element that holds a nested `<style>`, so
  `.field` matches nothing there (`LUM3005`). Move the block to the top level of the file (it
  styles every element of the file), or render that JSX inside the styled element.

See also: [Styles](../concepts/styles.md), [`@lumiose/vite`](vite.md), [JSX `style` and `class`](../concepts/jsx.md).
