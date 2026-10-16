# Scroll Area

> A scrolling region with custom scrollbars laid over native scrolling, after Base UI's ScrollArea. The viewport scrolls natively (the wheel, touch, the keyboard, find-in-page), is focusable while it overflows, and traps nothing; without JavaScript its native scrollbars show. `<lu-scroll-area>`'s 1.6 kB script hides them and draws its own, which show on hover, while scrolling and while focused, take a thumb drag and a track press, and expose the overflow as data attributes and CSS variables.

```ts
import { ScrollArea } from "@lumiose/ui"; // or "@lumiose/ui/scroll-area"
import "@lumiose/ui/scroll-area.css"; // or "@lumiose/ui/styles.css" for every component
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<ScrollArea.Root>
  <ScrollArea.Viewport>
    <ScrollArea.Content />
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Scrollbar orientation="horizontal">
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
  <ScrollArea.Corner />
</ScrollArea.Root>
```

| Part        | Renders                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-scroll-area>`: give it a size (a height or a max height); the viewport fills it                |
| `Viewport`  | `<div tabindex="0" data-viewport>`: scrolls natively; `tabindex="-1"` while nothing overflows       |
| `Content`   | `<div>`, at least as wide as what it holds                                                          |
| `Scrollbar` | `<div aria-hidden="true" data-scrollbar data-orientation>` over an edge; hidden while its axis fits |
| `Thumb`     | `<div data-thumb>`, sized and moved by the script                                                   |
| `Corner`    | `<div data-corner hidden>`, where the scrollbars meet, shown while both axes overflow               |

## API

### ScrollArea.Root

| Prop                    | Type     | Default |                                                                                       |
| ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `overflowEdgeThreshold` | `number` | `0`     | How many px of content past an edge before `data-overflow-*-start` or `-end` applies. |

### ScrollArea.Scrollbar

| Prop          | Type                         | Default      |                                                             |
| ------------- | ---------------------------- | ------------ | ----------------------------------------------------------- |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | The edge and axis: the inline end, or the bottom.           |
| `keepMounted` | `boolean`                    | `false`      | Keeps the scrollbar shown while its axis does not overflow. |

### The other parts

Each part passes the props of its element through. Give the `Viewport` an `aria-label`, and
`role="region"` when it holds a section people should find: it is a tab stop while it overflows
(and in server HTML before the script, which cannot know whether it will). The scrollbars are
`aria-hidden` pointer conveniences, since the viewport itself scrolls from the keyboard.

**Data attributes and CSS variables.** On Root and Viewport: `data-has-overflow-x`,
`data-has-overflow-y`, `data-overflow-x-start`, `-x-end`, `-y-start`, `-y-end`, `data-scrolling`
(Root). On the Viewport: `--lu-scroll-area-overflow-x-start` (and `-x-end`, `-y-start`, `-y-end`),
the px of content past each edge, for fades. On the Scrollbars: `data-orientation`,
`data-hovering`, `data-scrolling`, and `--lu-scroll-area-thumb-height` (or `-width`). On Root:
`--lu-scroll-area-corner-width` and `-height`.

**What CSS can do alone.** `scrollbar-color`, `scrollbar-width` and `scrollbar-gutter` recolour
and thin the native scrollbar in every current browser, with no script; they cannot shape it, lay
it over the content, or show it only on hover. Style the native scrollbar that way for pages
without JavaScript; the custom scrollbars take over once the script runs.

**Differences from Base UI's ScrollArea.** The custom properties are `--lu-scroll-area-*` (Base
UI's `--scroll-area-*`); the viewport is focusable while it overflows; no `render`.

## Example

```tsx check
import { ScrollArea } from "@lumiose/ui";

const RELEASES = ["1.4.0", "1.3.2", "1.3.1", "1.3.0", "1.2.0", "1.1.0", "1.0.0"];

export function ReleaseList() {
  return (
    <ScrollArea.Root class="lu-scroll-area" style={{ "block-size": "8rem" }}>
      <ScrollArea.Viewport role="region" aria-label="Releases">
        <ScrollArea.Content>
          <ul>
            {RELEASES.map((release) => (
              <li>{release}</li>
            ))}
          </ul>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar>
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-scroll-area` on `Root`: a bordered box, padded content, 10px
scrollbars whose rounded thumbs (`--lu-muted-foreground`, 3:1) show while the pointer is over the
area, while it scrolls and while it has focus, and an inward focus ring on the viewport. Each
thumb takes presses over 24 by 24 px at least (WCAG 2.5.8), reaching 16px into the content; the
track stays 10px, which the wheel, the keyboard and the thumb stand in for.

**With your own CSS**, style the parts through `class`, `[data-scrollbar]`, `[data-thumb]`,
`[data-orientation]`, `[data-hovering]`, `[data-scrolling]` and the overflow attributes and
custom properties above; a fade at an edge reads `--lu-scroll-area-overflow-y-end`.

`@lumiose/ui/scroll-area.css` (0.3 kB brotli) fills the root with the viewport, hides the native
scrollbar once the script runs (`:defined`) and the custom ones until then, places the scrollbars
over the edges leaving room for the corner, and sizes the thumbs from the custom properties.

## Keyboard and focus

| Key                         | Does                                                    |
| --------------------------- | ------------------------------------------------------- |
| Tab                         | Onto the viewport while it overflows, then on: no trap. |
| Arrow keys                  | Scroll a line.                                          |
| Page Up / Page Down / Space | Scroll a page.                                          |
| Home / End                  | The top or the bottom.                                  |

The keys are the browser's own scrolling of the focused viewport. A focusable child (a link) takes
focus first, and the viewport scrolls it into view.

## Without JavaScript, and the element's script

The viewport scrolls with its native scrollbars, from the keyboard too. It keeps its
`tabindex="0"` then, so an area that does not overflow is a tab stop with nothing to scroll: one
reason to name it. `<lu-scroll-area>`'s script
(1.6 kB brotli) hides them and runs the custom ones: thumbs sized and moved on every scroll and
resize (a ResizeObserver follows content that grows), dragging and track presses, the wheel over
a scrollbar (which scrolls the viewport, and the page once the viewport is at its end), hover and
scrolling states, the overflow attributes and variables, the corner, right to left.

## Browser support

`scrollbar-width: none` and `::-webkit-scrollbar`, ResizeObserver and pointer capture: every
supported browser.

## Related

- [Dialog](dialog.md): a modal whose long content scrolls in a Scroll Area.
- [Combobox](combobox.md) and [Select](select.md): lists that scroll on their own.
