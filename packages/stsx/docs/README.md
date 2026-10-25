# STSX

> `.stsx` files are TSX plus raw-CSS `<style>` blocks, scoped by where you put them and compiled at build time to plain scoped CSS. `@lumiose/stsx` brings them to React, React Router and Solid through a Vite plugin; Lumiose apps use them natively.

```tsx
// Counter.stsx (React)
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

The block styles only `Counter`'s elements: its `button` rule reaches no other button in the app.
`$brand.primary` is a constant from `tokens.ts`, folded into the CSS at build time.

**What you get:**

- **Plain CSS** next to the markup, with nesting and modern syntax, and none of the class names
  you would otherwise have to invent.
- **No runtime.** Styles become a static stylesheet: extracted per route, minified and lowered
  by Vite like any CSS. Elements carry a small marker, an attribute or a class.
- **Scope by placement:** a block styles the file, a component, or one element's subtree,
  depending on where it sits.
- **Typed constants** shared between TypeScript and CSS, in values and in media queries.
- **Editor support:** TypeScript and CSS features, class-name completion and unused-selector
  warnings across the JSX and the blocks.

**Status:** new. `@lumiose/stsx` shares the version of the other Lumiose packages.
It has been tested with React 19, React Router 8 (framework mode, with server rendering) and Solid
1.9 on Vite 8. Other JSX frameworks whose Vite plugin compiles `.tsx` files should work, but are
untested.

## Pages

- [Installation](installation.md): the Vite plugin for React, React Router and Solid, and the
  tsconfig for type checking.
- [Styles](styles.md): placement and scope, global blocks, `$name` constants, `:global()` and
  `:deep()`, keyframes, dynamic values, specificity and class passthrough.
- [Options](options.md): `classAttribute` and `scopedStyles`.
- [React Router](react-router.md): components in `.stsx`, route modules in `.tsx`, and CSS per route.
- [Type checking and editors](type-checking.md): `stsx typegen`, `tsc` and the language server.

In a Lumiose app, `.stsx` is the component format and needs no plugin of its own: see
[Styles](https://itsjavi.com/lumiose/docs/concepts/styles/) in the Lumiose docs. These pages ship in
`@lumiose/stsx` (`node_modules/@lumiose/stsx/docs`), so they match the installed version.
