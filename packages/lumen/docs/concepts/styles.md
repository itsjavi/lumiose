# Styles

> Write plain CSS in `<style>` blocks in `.stsx` files. Where a block sits decides its scope: a component, the file, or the whole app with `<style global>`. CSS reads JS constants as `$name`, inlined at build time.

## Concept

**Placement decides scope.**

| Placement                                                                            | Scope                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Inside a component's JSX, as a child of an intrinsic element or fragment (any depth) | That component's own templates, including closures inside it such as `.map` callbacks. It does not reach other components. |
| File top level (conventionally at the end of the file)                               | Every template in the file.                                                                                                |
| `<style global>` (anywhere a block is valid)                                         | The whole app, unscoped. Usually in the root `_layout.stsx`.                                                               |

**How scoping works.** Each scope with styles gets a token `data-l-<hash>` (a stable hash of the
file path, plus the component name). Every element of the scope's templates carries the token, and
the last compound of each selector gets `[data-l-<hash>]` (a +0,1,0 specificity bump). Dynamic
classes always work, because no element is pruned.

- `:global(.sel)` leaves a selector unscoped; `:deep(.sel)` scopes only the part before it.
- `@keyframes` names are scoped, and `animation` references are rewritten. Custom properties are
  not scoped.
- **Class passthrough.** When a parent passes `class` to a child component, the parent's scope
  tokens travel with it, so `.cta { … }` in the parent styles `<Button class="cta" />` wherever
  `Button` applies `props.class`.
- Within a file, file-level CSS comes first, then component blocks in source order.

**`$name` constants.** CSS can read build-time constants: `$radius`, `$theme.space.lg`. They work
in property values and in `@media`, `@container` and `@supports` preludes — not in selectors,
property names, strings, comments or `url()`. A reference must be statically evaluable:

- a top-level `const` of the file;
- a `const` of the enclosing component (component blocks only);
- an `export const` of a `.ts`, `.tsx` or `.stsx` module.

Literals, template literals of constants, simple arithmetic and members of `as const` objects
qualify. Strings are inserted verbatim and numbers as-is, so add units with
`calc($gap * 1px)` or keep the unit in the constant. Imports used only by `$` references are
removed from the JS output, and editing them hot-reloads the CSS only.

**Runtime values** go through custom properties: `style={{ "--progress": pct() }}` and
`width: var(--progress)` in CSS. There is no reactive CSS and no JS inside CSS.

**Blocks are plain CSS:** no Sass, no `lang`, `media` or other attributes (only `global`). CSS
imports, CSS Modules, Tailwind v4 and `.scss` imports still work through Vite.

> **Status:** blocks are scanned, masked for TypeScript and checked, and the CSS compiler
> (scoping, `$name` substitution, keyframes) exists, but the Vite plugin does not emit the CSS
> yet: a style block's module is empty until the CSS pipeline lands.

## API

| Syntax                                  | Meaning                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `<style>…</style>` in component JSX     | Component-scoped CSS.                                        |
| `<style>…</style>` at module top level  | File-scoped CSS. Must come after the `const`s it references. |
| `<style global>…</style>`               | Unscoped, app-wide CSS.                                      |
| `$name`, `$obj.key`                     | A build-time constant.                                       |
| `:global(sel)`, `:deep(sel)`            | Escape or extend the scope.                                  |
| `style={{ "--x": value }}` + `var(--x)` | Runtime values.                                              |

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
- **Non-constant references.** `$count` where `count` is a signal or a `let` is `LUM3008`. Pass
  runtime values with `style={{ "--count": count() }}` and `var(--count)`.
- **A top-level block before the `const`s it reads.** Move the block to the end of the file
  (`LUM3013`).
- **`<style>` in a `.tsx` file.** It is a type error in `.tsx` (and `LUM1006` for raw CSS); rename the file to `.stsx`.
- **Attributes on `<style>`.** Only `global` is allowed (`LUM1005`).
- **Expecting a parent's styles to reach into children.** Scopes stop at component boundaries;
  pass `class` (passthrough) or use `:deep()`.

## Related diagnostics

- [LUM1004](../errors/LUM1004.md), [LUM1005](../errors/LUM1005.md), [LUM1006](../errors/LUM1006.md): unclosed block, unknown attribute, raw CSS in `.tsx`.
- [LUM3005](../errors/LUM3005.md): unused scoped selector.
- [LUM3008](../errors/LUM3008.md), [LUM3009](../errors/LUM3009.md), [LUM3013](../errors/LUM3013.md): `$` reference problems.
- [LUM3010](../errors/LUM3010.md), [LUM3011](../errors/LUM3011.md): misplaced blocks.
- [LUM3012](../errors/LUM3012.md): custom property set but never read.

See also: [Components](components.md), [JSX `style` and `class`](jsx.md).
