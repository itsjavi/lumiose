# @lumiose/stsx

`.stsx` files for React, Solid and other JSX frameworks: TSX plus raw-CSS `<style>` blocks,
scoped by where you put them, compiled at build time to plain scoped CSS. No CSS-in-JS runtime, no
class-name strings to invent.

```tsx
// Counter.stsx
import { useState } from "react";
import { brand } from "./tokens.ts";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="counter">
      <style>
        .counter { display: flex; gap: 8px; }
        button { background: $brand.primary; color: white; }
      </style>
      <button onClick={() => setCount(count + 1)}>count: {count}</button>
    </div>
  );
}
```

The `<style>` block styles only `Counter`'s elements: that `button` rule does not reach any other
button. `$brand.primary` is a constant from `tokens.ts`, folded into the CSS at build time.

## Setup

```sh
pnpm add -D @lumiose/stsx
```

Add the plugin **before** your framework's plugin, and tell it which attribute holds classes:

```ts
// vite.config.ts (React)
import react from "@vitejs/plugin-react";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [stsx({ classAttribute: "className" }), react()] });
```

| Framework                     | `classAttribute` | Framework plugin                              |
| ----------------------------- | ---------------- | --------------------------------------------- |
| React                         | `"className"`    | `@vitejs/plugin-react`                        |
| React Router (framework mode) | `"className"`    | `reactRouter()` from `@react-router/dev/vite` |
| Solid                         | `"class"`        | `vite-plugin-solid`                           |

## Styles

- **Placement decides scope.** A `<style>` block at the top level of the file styles every
  component in the file. A block inside a component's JSX styles the element that contains it and
  everything inside it in that component. `<style global>` is not scoped.
- **Plain CSS.** Nesting, media queries and modern syntax; Vite's CSS pipeline lowers it for your
  `build.cssTarget` and extracts it (per route under React Router).
- **`$name` constants** from the same file or imported from `.ts` modules, in values and in
  `@media`, `@container` and `@supports` conditions: `@media (width < $BREAKPOINT)`.
- **`:global(.x)`** leaves a selector unscoped; **`:deep(.x)`** reaches elements rendered by child
  components (`.card :deep(a)`).
- **Hot updates.** A style-only edit replaces the stylesheet without re-rendering; other edits go
  through your framework's refresh.

## Options

```ts
stsx({
  classAttribute: "className", // required: "className" or "class"
  scopedStyles: {
    strategy: "attribute", // or "class"
    specificity: "default", // or "zero"
    namespace: "lum",
  },
});
```

- **`strategy`**: `"attribute"` marks elements with `data-lum-<hash>` attributes. `"class"` merges
  `lum-<hash>` classes into `classAttribute`. It also lets a parent's styles reach a child component
  through the class it forwards: `.cta {}` in the parent styles `<Button className="cta" />` when
  `Button` puts `props.className` on its element.
- **`specificity`**: `"default"` adds (0,1,0) to each scoped selector; `"zero"` wraps the marker in
  `:where()`, so global rules and utility classes override component styles by source order.
- **`namespace`**: the start of the marker names.

## Limits

- **React Router route modules cannot be `.stsx` files**: React Router finds route modules by
  their file path. Keep the route module in `.tsx` and render components from `.stsx` files.
- With the attribute strategy, a parent's styles reach child components only through `:deep()`.

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
