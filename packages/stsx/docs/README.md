# STSX

> STSX (Styled TSX): `.stsx` files are TSX with plain-CSS `<style>` blocks, scoped by placement and compiled at build time. A Vite plugin for React, React Router and Solid, and native in Lumiose.

```tsx
// Counter.stsx (React)
import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="counter">
      <style>
        .counter { display: flex; gap: 8px; }
        button { background: var(--brand); color: white; }
      </style>
      <button onClick={() => setCount(count + 1)}>count: {count}</button>
    </div>
  );
}
```

The block styles only `Counter`'s elements: its `button` rule reaches no other button in the app.
`--brand` is one of your design's custom properties, declared on `:root`.

**What you get:**

- **Plain CSS** next to the markup, with nesting and modern syntax, and none of the class names
  you would otherwise have to invent.
- **No runtime.** Styles become a static stylesheet: extracted per route, minified and lowered
  by Vite like any CSS. Elements carry a small marker, an attribute or a class.
- **Scope by placement:** a block styles the file, a component, or one element's subtree,
  depending on where it sits.
- **Constants shared with TypeScript** (`$name`), for media query breakpoints and the values
  your JS also uses, and typed custom property names (`var($vars.brand)`), so a typo fails the
  build.
- **Editor support:** TypeScript and CSS features, class-name completion and unused-selector
  warnings across the JSX and the blocks.

**Status:** new. `@lumiose/stsx` shares the version of the other Lumiose packages.
It has been tested with React 19, React Router 8 (framework mode, with server rendering) and Solid
1.9 on Vite 8. Other JSX frameworks whose Vite plugin compiles `.tsx` files should work, but are
untested.

## Pages

- [Installation](installation.md): the Vite plugin for React, React Router and Solid, and the
  tsconfig for type checking.
- [Styles](styles.md): placement and scope, global blocks, design tokens as custom properties,
  `$name` constants, `:global()` and `:deep()`, keyframes, dynamic values, specificity and class
  passthrough.
- [Options](options.md): `classAttribute` and `scopedStyles`.
- [React Router](react-router.md): components in `.stsx`, route modules in `.tsx`, and CSS per route.
- [Type checking and editors](type-checking.md): `stsx typegen`, `tsc` and the language server.

In a Lumiose app, `.stsx` is the component format and needs no plugin of its own: see
[Styles](https://lumiose.dev/docs/concepts/styles/) in the Lumiose docs. These pages ship in
`@lumiose/stsx` (`node_modules/@lumiose/stsx/docs`), so they match the installed version.
