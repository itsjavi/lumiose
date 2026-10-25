# Styles

> A `<style>` block holds plain CSS and styles what encloses it: the file at the top level, a component or one element's subtree inside JSX, or the whole app with `global`. Constants come from TypeScript with `$name`; `:global()` and `:deep()` cross the scope.

## Placement decides scope

| Placement                                       | Styles                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Top level of the file (outside every component) | Every element of every component in the file                                    |
| Inside a component's JSX                        | The element that contains the block and everything inside it, in that component |
| `<style global>`, anywhere                      | The whole app, unscoped                                                         |

```tsx
export function Nav() {
  return (
    <nav>
      <style>
        a { color: inherit; }
      </style>
      <a href="/">Home</a>
    </nav>
  );
}

<style>
  nav { display: flex; gap: 1rem; }
</style>

<style global>
  body { margin: 0; }
</style>
```

A block inside JSX must be a static child of an element or fragment: not inside a condition, a
`.map()` or another `{…}` expression, and not the only thing a component returns. Use classes for
variations.

Every element in a scope carries the scope's marker, so dynamic classes and elements created
later (lists, conditions) match the scope's rules too. Elements rendered by **another component**
do not: reach them with `:deep()`, or with class passthrough (below).

## Plain CSS

Blocks are CSS, as in a `.css` file: nesting, `@media`, `@container`, `@supports`, `@layer`,
custom properties and modern syntax. Vite lowers it for your `build.cssTarget`, minifies it, and
extracts it into the stylesheet of the chunk or route that imports the component. Sass and other
`lang` attributes are not supported; import `.scss` files through Vite instead.

## Constants: `$name`

A `$name` reference in a value or in an `@media`, `@container` or `@supports` condition is
replaced at build time by a constant:

```tsx
import { BREAKPOINT, radius } from "./tokens.ts";

const accent = "#e11d48";

<style>
  .card { border-radius: $radius.lg; border-color: $accent; }
  @media (width < $BREAKPOINT) { .card { padding: 0; } }
</style>
```

- **Eligible.** Top-level `const` bindings of the file, `export const` imports from `.ts`,
  `.tsx` or `.stsx` modules, and local `const` bindings of the component (for a block in its JSX).
  Their values must be statically known: literals, template literals of constants, members of
  `as const` objects and arrays, and simple arithmetic.
- **Strings** go in as raw CSS text, **numbers** as they are: write `"8px"`, or
  `calc($gap * 1px)`.
- **Dot notation** for object members (`$brand.primary`); `$brand-primary` is an error, since
  JavaScript names cannot contain `-`.
- **Not replaced** in selectors, property names, strings, comments or `url()`. In selectors,
  `[href$=".pdf"]` keeps its CSS meaning.
- **Updates.** Editing `tokens.ts` in dev updates the CSS of every file that uses it.

CSS has no JavaScript expressions: blocks are static. For a value that changes at runtime, set a
custom property in the `style` prop and read it with `var()`:

```tsx
<div className="bar" style={{ "--progress": `${percent}%` }}>
  <style>
    .bar { width: var(--progress); }
  </style>
</div>
```

## Escapes: `:global()` and `:deep()`

- **`:global(sel)`** leaves `sel` unscoped: `.menu :global(.icon)` styles any `.icon` inside the
  menu, and `:global(body.dark) .menu` reads a class on `<body>`.
- **`:deep(sel)`** scopes only what is on its left: `.card :deep(a)` styles links that a child
  component renders inside `.card`.

## Keyframes

`@keyframes` names are scoped per block's scope, and `animation` and `animation-name` references
to them are rewritten, so two components can each define `@keyframes spin` without a clash.

## Specificity

By default a scoped selector gets one extra attribute or class, a (0,1,0) bump: `.note` becomes
`.note[data-lum-a1b2c3d4]`. A component's rules then win over global rules of the same
specificity. With `scopedStyles: { specificity: "zero" }` the marker goes inside `:where()` and
adds nothing, so a global or utility class written later wins ([Options](options.md)).

## Class passthrough

With `scopedStyles: { strategy: "class" }`, the scope travels with the class you pass to a
component:

```tsx
// Parent.stsx
import { Button } from "./Button.tsx";

export function Toolbar() {
  return (
    <div>
      <style>
        .cta { font-weight: bold; }
      </style>
      <Button className="cta">Save</Button>
    </div>
  );
}
```

The parent's scope classes are appended to `className`. A `Button` that puts `props.className` on
its element, as most components do, receives them, and `.cta` styles it. With the default
attribute strategy, use `:deep()` instead.

## Diagnostics

The plugin reports problems in the dev overlay and the build output, with a code frame:

- **`LUM3005`, unused selector.** A selector that matches no element of its scope (it reads
  `classAttribute`).
- **`LUM3008`, unresolvable constant.** A `$name` that is not a constant.
- **`LUM3009`, hyphenated reference.** `$brand-primary`.
- **`LUM3010` and `LUM3011`, misplaced block.** A block in a condition, or one that is a
  component's only output.
- **`LUM3014` to `LUM3020`.** CSS syntax and value problems.

Each code has a page in the [Lumiose error reference](https://itsjavi.com/lumiose/docs/errors/).
