# Preview Card

> A card that previews a link's destination while the pointer or keyboard focus rests on the link, after Base UI's PreviewCard. The trigger is the link itself, which works as a link without JavaScript; the card is a manual popover placed with [Popover](popover.md)'s placement and opened with its hover timing by a 2.2 kB script. It is hoverable, persistent and dismissible (WCAG 1.4.13). `bind:open` keeps a signal in sync.

```ts
import { PreviewCard } from "@lumiose/ui"; // or "@lumiose/ui/preview-card"
import "@lumiose/ui/preview-card.css"; // places the card next to its link
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<PreviewCard.Root>
  <p>
    … <PreviewCard.Trigger href="…" /> …
  </p>
  <PreviewCard.Popup />
</PreviewCard.Root>
```

| Part      | Renders                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `Root`    | No element. Holds the ids the other parts share.                                                           |
| `Trigger` | `<a href data-preview-card="…">`, with an `anchor-name` in its `style`; `data-popup-open` while it is open |
| `Popup`   | `<div popover="manual" data-side data-align>`, placed next to the link                                     |

The card is a `<div>`: put it after the paragraph that holds the link, not inside it (a `<p>`
cannot hold a `<div>`), with the Root around both.

## API

### PreviewCard.Root

| Prop           | Type                      | Default |                                                           |
| -------------- | ------------------------- | ------- | --------------------------------------------------------- |
| `open`         | `boolean`                 |         | Opens or closes the card when it changes, in the browser. |
| `onOpenChange` | `(open: boolean) => void` |         | Called after the card opens or closes, whatever did it.   |
| `bind:open`    | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`.                  |

### PreviewCard.Trigger

| Prop         | Type     | Default |                                                                                |
| ------------ | -------- | ------- | ------------------------------------------------------------------------------ |
| `delay`      | `number` | `600`   | How long the pointer or focus rests on the link before the card opens, in ms.  |
| `closeDelay` | `number` | `300`   | How long the card stays after the pointer leaves the link and the card, in ms. |

Every other `<a>` prop passes through: `href`, `target`, `class`, `aria-*`.

### PreviewCard.Popup

`side`, `align`, `sideOffset` and `alignOffset`, as on [Popover.Popup](popover.md#popoverpopup);
every other `<div>` prop passes through.

**Differences from Base UI's PreviewCard.** No `Portal`, `Positioner` or `Viewport`: the top
layer and CSS anchor positioning replace them, and the placement props are on `Popup`.

- **No `Backdrop`**: the open card is in the top layer, so `.lu-preview-card::backdrop` styles the
  layer under it, without an element.
- **No `Arrow`**, as in Popover and Tooltip: anchor positioning gives no arrow offset when the card
  shifts to fit. A pointer that follows `data-side` is a `::before` of your CSS.
- **No detached triggers** (`handle`, `payload`) or `actionsRef`: a card's content is markup
  rendered with it, so each link has its Root and its card, in server HTML too. In an island, a
  signal per link does what a payload does.

## Example

```tsx check
import { PreviewCard } from "@lumiose/ui";

export function SignalsLink() {
  return (
    <PreviewCard.Root>
      <p>
        Lumiose components update through{" "}
        <PreviewCard.Trigger href="/docs/concepts/signals">signals</PreviewCard.Trigger>.
      </p>
      <PreviewCard.Popup class="lu-preview-card">
        <strong>Signals</strong>
        <p>Values that update whatever reads them.</p>
      </PreviewCard.Popup>
    </PreviewCard.Root>
  );
}
```

A card is a visual enhancement, as Base UI says: what it shows should also be on the linked page.

## Styling

**With the default theme**, put `lu-preview-card` on `Popup`: a surface like a popover's, 8px from
the link, with a fade (none where motion is reduced).

**With your own CSS**, style the card through `class`, `:popover-open`, `[data-side]` and
`[data-align]`, and the link through `[data-popup-open]`. `--lu-side-offset` and
`--lu-align-offset` set the offsets.

`@lumiose/ui/preview-card.css` is the placement Popover and Tooltip share (placement.css).

## Keyboard and focus

| Key    | Does                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| Tab    | Onto the link: the card opens after the delay, focus stays on the link. Again: into the open card, then on. |
| Escape | Closes the card, without moving focus or the pointer.                                                       |
| Enter  | Follows the link.                                                                                           |

- **Hover** opens the card after the delay; it stays while the pointer is on the link or the card
  (it may cross the gap between them) and closes after the close delay once it left both.
- **Focus** opens it too; it closes when focus leaves the link and the card. The open card follows
  its link in the focus order (the link is its invoker).
- **Touch** follows the link: no card opens on a tap.
- **A press outside** closes it, as Escape does (the dismissal model of Popover and Menu).

## Without JavaScript, and the client script

The link is a plain link and the card never opens. A page that renders a `PreviewCard` loads a
2.2 kB (brotli) module once (with the hover timing it shares with Popover): hover and focus with
their delays, dismissal, `data-popup-open`, and the placement in browsers without CSS anchor
positioning.

## Browser support

Popover and CSS anchor positioning as in [Popover](popover.md#browser-support): the script places
the card where anchor positioning is missing.

## Related

- [Popover](popover.md): a popup a click opens, or a hover with `openOnHover`.
- [Tooltip](tooltip.md): a short text tip on hover or focus.
