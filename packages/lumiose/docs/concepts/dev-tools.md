# Dev tools

> The in-page inspector of `lumiose dev`: the component tree with props and source locations, signals with their dependents and last write, islands with their hydration state, why something updated, and Alt+click to open any element's source.

## Concept

`lumiose dev` adds an **inspector** to every page, in place of a browser extension such as React
DevTools. Press **Alt+Shift+L**, or click the small orb in the bottom-left corner, to open it at the
bottom of the window. It renders in a closed shadow root, so your styles do not reach it and your
tests' locators do not find it, and it works under `lumiose({ csp: "strict" })`.

It has four panels:

| Panel                   | Shows                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tree**                | The components the browser runs (islands, `spa` pages, `render()` roots), nested as they render. Select one for its props (getters are read safely, `children` is not), its source location, what it owns and, for an island's root, the island. Hovering a row outlines its DOM.                                                                                                                                 |
| **Signals**             | The signals, computeds and store properties a component created, or those created outside components (module scope, event handlers): the current value, what depends on them, and the last write (old → new value, when, and where). Below, its effects and bindings with their run counts. Lumiose's own signals (a resource's state, a `<Suspense>` count, the router's URL) are hidden until you ask for them. |
| **Islands**             | Every island on the page: its `client:*` strategy, its state (`waiting`, `loading`, `hydrating`, `hydrated`, `failed`), when the loader armed it, how long its module took to load and how long hydration took, and the error of an island that failed to load or hydrate.                                                                                                                                        |
| **Why did this update** | For the element you select (⌖ **Select**, then click it on the page), the bindings that update it and, for each, the writes that last re-ran it, through the computeds in between: `doubled ← count: 1 → 2 in src/Counter.stsx (onClick)`. Below, the latest updates on the page.                                                                                                                                 |

**Alt+click** any element to open its source at the line in your editor, through Vite's
open-in-editor endpoint. It works on server-rendered markup too, not only on islands: in dev, the
compiler gives every element a `data-lumiose-source="src/routes/page.stsx:12:5"` attribute, on the
server and in the browser alike. While you hold Alt, the element it would open is outlined.

**What the inspector sees.** Server-only components (pages and layouts of `static` and `server`
routes) run on the server, so they have no client tree: the Tree lists islands and `spa` pages,
and Alt+click covers everything. Signal names come from the variables they are assigned to
(`const count = signal(0)`), which the compiler passes in dev; a signal assigned elsewhere shows as
`signal #12`.

**It costs nothing in builds.** The reactive core, the DOM runtime and the island loader report to
the inspector's registry only behind a dev-only flag that `lumiose dev` sets, so `lumiose build`
output contains none of it, byte for byte. `lumiose({ inspector: false })` turns it off in dev too:
no corner button, no shortcut, no source attributes, no recording.

## API

| Name                             | What it does                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Alt+Shift+L                      | Opens and closes the inspector. It remembers whether it was open, per tab.                               |
| The corner button                | Opens the inspector.                                                                                     |
| ⌖ Select                         | Picks an element on the page: Tree selects its component, Why did this update explains it. Esc cancels.  |
| Alt+click                        | Opens the element's source in your editor.                                                               |
| `lumiose({ inspector: false })`  | Turns the inspector off ([`@lumiose/vite`](../reference/vite.md#lumiose)). Default: on in `lumiose dev`. |
| `data-lumiose-source` (dev only) | The element's source location, `<file>:<line>:<column>`, root-relative.                                  |

Vite opens files with [`launch-editor`](https://github.com/yyx990803/launch-editor): the editor named
by the `LAUNCH_EDITOR` environment variable, else the one it finds running, else `VISUAL` or
`EDITOR`.

## Example

```tsx
// src/components/Counter.stsx, used as <Counter client:visible start={1} />
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

| Mistake                                       | What happens                                                                                    | Instead                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Looking for a page's server component in Tree | It is not there: it ran on the server.                                                          | Alt+click its markup to open it; Tree lists what runs in the browser.                                  |
| Reading a computed marked `(stale)` as wrong  | Nothing read it since its inputs changed, so it has not re-evaluated (computeds are lazy).      | It updates on its next read. The inspector never evaluates it, so it never changes what your app runs. |
| Expecting the line where a signal was written | The last write names the file and the function, not the line: the stack has compiled positions. | Open the file from the source link, or Alt+click the element.                                          |
| Alt+click opening the wrong editor, or none   | `launch-editor` picked another editor, or found none.                                           | Set `LAUNCH_EDITOR` (for example `code`, `cursor`, `webstorm`) in the environment of `lumiose dev`.    |
| Asserting on `data-lumiose-source` in tests   | The attribute exists only in `lumiose dev`, not in builds or under Vitest.                      | Test the built app, or select elements by role and text.                                               |

## Related diagnostics

None: the inspector reports nothing itself. The diagnostics it helps explain, such as
[LUM2001](../errors/LUM2001.md) (a value computed once that never updates), appear in the
terminal, the editor and Vite's overlay.
