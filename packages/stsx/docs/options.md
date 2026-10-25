# Options

> `stsx({ classAttribute, scopedStyles })`: the JSX attribute that holds classes (required), and how scoped elements are marked and matched: attribute or class, default or zero specificity, and the marker's namespace.

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

Invalid options stop Vite when the config loads, with the option and the expected values.

## `classAttribute`

The attribute that holds class names in your JSX: `"className"` for React and Preact, `"class"`
for Solid. The unused-selector check (`LUM3005`) reads it. With the class strategy, the scope
classes are merged into it, and class passthrough appends the parent's scope to the one passed to
a component.

## `scopedStyles`

| `strategy`            | `specificity`       | Element                     | `.note` becomes                    |
| --------------------- | ------------------- | --------------------------- | ---------------------------------- |
| `attribute` (default) | `default` (default) | `data-lum-a1b2c3d4`         | `.note[data-lum-a1b2c3d4]`         |
| `attribute`           | `zero`              | `data-lum-a1b2c3d4`         | `.note:where([data-lum-a1b2c3d4])` |
| `class`               | `default`           | `class="note lum-a1b2c3d4"` | `.note.lum-a1b2c3d4`               |
| `class`               | `zero`              | `class="note lum-a1b2c3d4"` | `.note:where(.lum-a1b2c3d4)`       |

- **`strategy: "attribute"`** adds empty `data-<namespace>-<hash>` attributes and leaves your
  class names alone.
- **`strategy: "class"`** merges `<namespace>-<hash>` classes into `classAttribute`: appended to
  a string, combined with a computed value, added to an element without one. It also enables
  class passthrough to child components ([Styles](styles.md#class-passthrough)). Choose it when
  something strips or rejects `data-*` attributes, or for passthrough.
- **`specificity: "zero"`** wraps the marker in `:where()`: scoped rules then tie with global rules
  of the same specificity, and source order decides. Choose it when global styles or utility
  classes should override component styles without `!important`. Every evergreen browser
  supports `:where()`.
- **`namespace`** starts with a lowercase letter and holds lowercase letters, digits and hyphens.
  Change it to avoid clashes with another library's markers.

The hash is stable: it comes from the file's path relative to the project root (and the
component's name), so builds on different machines produce the same markers. A `.stsx` file in a
linked workspace package outside the root is named relative to its package.
