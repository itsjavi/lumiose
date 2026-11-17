# Styles

> Write plain CSS in `<style>` blocks: where a block sits decides its scope. Design tokens are CSS custom properties, and `$name` brings in the JS constants that CSS and JS share.

## Concept

### One block per file, at the end

A top-level `<style>` after the components styles every template in the file, and no other file.
Here `button` matches the buttons of `Counter` and `Reset`. Blocks are plain CSS: no Sass, and no
attributes except `global`.

```stsx check
import { signal } from "lumiose";

export function Counter() {
  const count = signal(0);

  return (
    <div class="counter">
      <button onClick={() => count.update((n) => n + 1)}>{count()}</button>
      <Reset onReset={() => count.set(0)} />
    </div>
  );
}

export function Reset(props: { onReset: () => void }) {
  return (
    <button class="reset" onClick={props.onReset}>
      Reset
    </button>
  );
}

<style>
  .counter { display: flex; gap: 0.5rem; }
  button {
    padding: 0.5rem 1rem;
    border: 0;
    border-radius: var(--radius);
    background: var(--accent);
    color: white;
  }
  .reset { background: transparent; color: var(--accent); }
</style>
```

### Placement decides scope

| Placement                                                                            | Scope                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File top level (by convention, one block at the end of the file)                     | Every template in the file.                                                                                                                                                                                                                                                                                                   |
| Inside a component's JSX, as a child of an intrinsic element or fragment (any depth) | Its **enclosing element and everything written inside it** in that component, including `.map` callbacks and JSX passed as children there. A block directly under the component's root element therefore covers the whole component. Sibling subtrees are not affected, and it never reaches other components' own templates. |
| `<style global>` (anywhere a block is valid)                                         | The whole app, unscoped. Usually at the end of the root `layout.stsx`.                                                                                                                                                                                                                                                        |

### Nested blocks

A block inside a component's JSX styles its enclosing element's subtree. Use one to keep a selector
such as `p` inside that subtree, or to read a constant declared inside the component.

```stsx check
export function Panel(props: { items: string[] }) {
  const columns = 3;

  return (
    <div class="panel">
      <aside class="side">…</aside>                 {/* not styled by the <style> below */}
      <section class="body">
        <p class="note">{Math.ceil(props.items.length / columns)} rows</p>
        <style> p { color: tomato; } </style>      {/* only the <p> of this <section> */}
      </section>
      <style> .panel { grid-template-columns: repeat($columns, 1fr); } </style>   {/* reads `columns` */}
    </div>
  );
}

<style>
  .panel { display: grid; }
</style>
```

> **Widening:** moving a block from a component's root to the end of the file widens its scope to
> every component in the file. Check that its selectors (bare element selectors in particular) do
> not start matching another component's elements.

> **Across files:** a file's blocks never style components defined in other files. Pass `class`
> ([class passthrough](../reference/styles.md#class-passthrough)) or use `:deep(.sel)`;
> `:global(.sel)` leaves a selector unscoped. The mechanics, and the `scopedStyles` option that
> changes the marker: [How scoping works](../reference/styles.md#how-scoping-works).

### Design tokens

Colors, spacing, radii and fonts are CSS custom properties (decision-87). Declare them once on
`:root`, usually in the root layout's `<style global>` (or an imported stylesheet), and read them with `var()` in every block.
A theme or dark mode overrides them with a selector or a media query, a section of the page can
override a few through the cascade, and they show up in devtools.

```stsx check
// src/routes/layout.stsx
import type { LayoutProps } from "lumiose";

export default function Layout(props: LayoutProps<"/">) {
  return <div class="app">{props.children}</div>;
}

<style global>
  :root {
    --accent: #5546ff;
    --surface: #f4f4f5;
    --radius: 10px;
    --space: 0.5rem;
  }
  :root[data-theme="dark"] {
    --accent: #8b80ff;
    --surface: #27272a;
  }
</style>
```

> **Typed names:** `var($vars.accent)` reads the name from an `as const` module, so a typo fails
> the build: [Typed token names](../reference/styles.md#typed-token-names).

### JS values in styles

`$name` inlines a JS constant at build time. Use it where `var()` cannot work, such as a `@media`
condition, and for values that JS also uses.

```stsx check
// Also read by the app's JS: matchMedia(`(width < ${narrow})`).
export const narrow = "40rem";
const columns = 3;

export function Grid(props: { children?: JSX.Element }) {
  return <div class="grid">{props.children}</div>;
}

<style>
  .grid { display: grid; grid-template-columns: repeat($columns, 1fr); }
  @media (width < $narrow) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
```

The CSS ships as `repeat(3, 1fr)` and `@media (width < 40rem)`: no runtime lookup.

> **Rules:** what a reference can name, units and the diagnostics:
> [JS values in styles](../reference/styles.md#js-values-in-styles). Constant `calc()`, `min()`
> and `clamp()` are computed at build time too:
> [Build-time math](../reference/styles.md#build-time-math).

### Runtime values

For a value that changes (a signal, a prop, a measurement), set a custom property with the `style`
prop and read it with `var()`. Custom properties are not scoped and inherit, so descendants can
read them too.

```stsx check
export function Progress(props: { pct: number }) {
  return <div class="bar" style={{ "--fill": `${props.pct}%` }} />;
}

<style>
  .bar { inline-size: var(--fill); block-size: 4px; background: var(--accent); }
</style>
```

### Other stylesheets

Style blocks hold a component's own styles. For a reset, a stylesheet from another project or
Tailwind, import `.css` files or CSS modules:
[Stylesheets, CSS Modules and Tailwind](../guides/stylesheets.md).

> **Builds:** `lumiose build` groups each page's stylesheets into at most three tags
> ([Build output](../reference/styles.md#build-output)).

> **Outside Lumiose:** `@lumiose/stsx` brings `.stsx` files and these style blocks to React, React
> Router and Solid through a Vite plugin, with the same placement rules, constants and
> `scopedStyles` option: see [STSX](https://lumiose.dev/stsx/).

## API

| Syntax                                   | Meaning                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `<style>…</style>` at module top level   | File-scoped CSS, shared by every component of the file. By convention one block, at the end of the file.  |
| `<style>…</style>` in component JSX      | CSS scoped to its enclosing element's subtree (the whole component when placed under the root element).   |
| `<style global>…</style>`                | Unscoped, app-wide CSS.                                                                                   |
| `var(--name)`                            | A custom property: design tokens (declared on `:root`) and runtime values.                                |
| `var($vars.name)`                        | A custom property whose name comes from an `as const` module, so a typo fails the build.                  |
| `$name`, `$obj.key`                      | A JS constant, inlined at build time, in property values and `@media`/`@container`/`@supports` preludes.  |
| `calc()`, `min()`, `max()`, `clamp()`, … | Folded at build time when every operand is a concrete value in compatible units.                          |
| `:global(sel)`, `:deep(sel)`             | Escape or extend the scope.                                                                               |
| `style={{ "--x": value }}` + `var(--x)`  | Runtime values.                                                                                           |
| `import "./app.css"`                     | A global stylesheet, linked on the pages whose import graph reaches it (every page from the root layout). |
| `import styles from "./x.module.css"`    | A CSS module: `styles.name` is the hashed class of `.name`.                                               |

## Example

```stsx check
// Read by the app's JS too: `matchMedia(`(width < ${BREAKPOINT})`)`.
const BREAKPOINT = "40rem";

export function Card(props: { title: string; progress: number; class?: string }) {
  return (
    <article class={["card", props.class]} style={{ "--progress": `${props.progress}%` }}>
      <h2>{props.title}</h2>
      <div class="bar" />
    </article>
  );
}

export function Dashboard(props: { stats: { title: string; progress: number }[] }) {
  const columns = 3;

  return (
    <main class="dashboard">
      {props.stats.map((stat, i) => (
        <Card key={stat.title} class={i === 0 ? "featured" : undefined} {...stat} />
      ))}
      <p class="summary">{Math.ceil(props.stats.length / columns)} rows</p>

      <style>
        .dashboard { grid-template-columns: repeat($columns, 1fr); }
        @media (width < $BREAKPOINT) { .dashboard { grid-template-columns: 1fr; } }
      </style>
    </main>
  );
}

<style>
  .dashboard { display: grid; gap: var(--space); }
  .summary { grid-column: 1 / -1; }
  .card { display: grid; gap: 0.5rem; padding: var(--space); border-radius: var(--radius); background: var(--surface); }
  .card h2 { margin: 0; }
  .bar { inline-size: var(--progress); block-size: 4px; background: var(--accent); }
  .featured { outline: 2px solid var(--accent); }
</style>
```

`Card` and `Dashboard` share the file-level block, which reads the design tokens declared on
`:root` ([Design tokens](#design-tokens)). `.featured` is set by `Dashboard` and styles the `<article>`
inside `Card`: both are in the file's scope (from another file, the class would get there through
class passthrough). The nested block in `Dashboard` is there because it reads `columns`, a
constant the component's JS also uses. `BREAKPOINT` is a `$` constant because `var()` does not
work in `@media`, and the app's JS checks the same width.

## Common mistakes

- **A design system in `$` constants.** They cannot change with a theme, a media query or the
  cascade. Use custom properties; keep `$` for breakpoints and values JS also uses.
- **A block inside `{…}`, a conditional, a `.map` callback or a component element.** Move it into
  an intrinsic element of the component (`LUM3010`).
- **Returning a block** (`return <style>…`). Put it inside the returned element (`LUM3011`).
- **Non-constant references.** `$count` for a signal, a prop or a `let` is `LUM3008`: pass it with
  `style={{ "--count": count() }}` and `var(--count)`.
- **A unitless number or a detached unit.** Write `calc($gap * 1px)`, not `$gap` or `$gap px`
  (`LUM3018`, `LUM3019`).
- **Expecting a nested block to style sibling subtrees.** Move its rules to the file-level block.
- **`<style>` in a `.tsx` file.** Rename the file to `.stsx` (`LUM1006`).

The full lists: [style blocks](../reference/styles.md#common-mistakes) and
[stylesheets and Tailwind](../guides/stylesheets.md#common-mistakes).

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

See also: [Components](components.md), [JSX `style` and `class`](jsx.md), [reference: style blocks](../reference/styles.md).
