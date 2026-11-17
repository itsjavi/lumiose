# Dev tools

> The in-page inspector of `lumiose dev`: the component tree with props and source locations, signals with their dependents and last write, islands with their hydration state, why something updated, and Alt+click to open any element's source.

## Concept

### Open the inspector

`lumiose dev` adds an inspector to every page. Press **Alt+Shift+L**, or click the square
button with the Lumiose logo in the bottom-left corner. Builds contain none of it.

```sh
$ lumiose dev
```

| Panel                   | Shows                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| **Tree**                | The components the browser runs, with props and source locations. |
| **Signals**             | A component's signals: value, dependents and the last write.      |
| **Islands**             | Each island's `client:*` strategy, state and timings.             |
| **Why did this update** | For a selected element, the writes that last re-ran its bindings. |

### Alt+click

In dev, every element that renders a box carries its source location, on the server too.
**Alt+click** an element to open that line in your editor.

```html
<h1 data-lumiose-source="src/routes/page.stsx:12:5">Hello</h1>
```

> **Details:** each panel in full, what the inspector sees, how the editor is chosen and why builds
> pay nothing: [The dev inspector](../reference/vite.md#the-dev-inspector).

## API

| Name                             | What it does                                                           |
| -------------------------------- | ---------------------------------------------------------------------- |
| Alt+Shift+L                      | Opens and closes the inspector. Remembered per tab.                    |
| The corner button                | Opens the inspector.                                                   |
| ⌖ Select                         | Picks an element for Tree and Why did this update. Esc cancels.        |
| Alt+click                        | Opens the element's source in your editor.                             |
| `lumiose({ inspector: false })`  | Turns it off in dev ([`@lumiose/vite`](../reference/vite.md#lumiose)). |
| `data-lumiose-source` (dev only) | `<file>:<line>:<column>`, root-relative.                               |

## Example

```tsx check
// src/components/Counter.stsx,
// used as <Counter client:visible start={1} />
import { computed, signal } from "lumiose";

export function Counter(props: { start: number }) {
  const count = signal(props.start);
  const doubled = computed(() => count() * 2);
  return (
    <button data-doubled={doubled()} onClick={() => count.update((n) => n + 1)}>
      {count()}
    </button>
  );
}
```

After two clicks, the inspector shows:

- **Tree:** `Counter` with the island badge `island · visible`, `Counter.stsx:4`, props
  `start: 1`, and "1 signal, 1 computed, 2 bindings".
- **Signals:** `count` = `3`, read by `doubled` and a binding of the button, last written `2 → 3`
  in `src/components/Counter.stsx` (its click handler); `doubled` = `6`.
- **Islands:** `Counter`, `visible`, `hydrated`, armed at 412 ms, load 3.1 ms, hydrate 0.4 ms.
- **Why did this update**, with the button selected: its two bindings, one last re-run by
  `doubled ← count: 2 → 3` (its value `6`, the `data-doubled` attribute), the other by
  `count: 2 → 3` (its text, `3`).

Alt+click the button: your editor opens `src/components/Counter.stsx` at line 8.

## Common mistakes

Each in full: [The dev inspector](../reference/vite.md#the-dev-inspector).

- **Looking for a page's server component in Tree.** It ran on the server; Alt+click its markup.
- **Reading a computed marked `(stale)` as wrong.** It updates on its next read.
- **Expecting the line of a write.** The last write names the file and the function.
- **Alt+click opens the wrong editor, or none.** Set `LAUNCH_EDITOR`.
- **Matching a dev page's raw HTML exactly in tests.** Dev adds `data-lumiose-source`.

## Related diagnostics

None: the inspector reports nothing itself. The diagnostics it helps explain, such as
[LUM2001](../errors/LUM2001.md) (a value computed once that never updates), appear in the
terminal, the editor and Vite's overlay.
