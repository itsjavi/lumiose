---
id: decision-62
title: '@lumiose/ui ports Timeless''s approach'
date: '2026-10-15 16:46'
status: accepted
---
## Context

Decision-54 set the direction for @lumiose/ui (accessible UI primitives, Timeless-based, Base UI's API as inspiration) and left open whether to depend on Timeless, port it or merge it. The TASK-332 spike prototyped dialog, menu and combobox for each option (examples/ui-spike). Depending on `@timelessui/components` 0.2.0 cost 14.75 kB brotli of JS for the three and showed four gaps with signals and ARIA (no dialog `open` property, the combobox shows the value instead of the label, `aria-selected` does not follow `value`, running a menu item leaves the menu open). The port cost 1.71 kB (dialog: none) with no such gaps. Merging fails to build: Timeless's TC39 decorators pass through Vite 8 unlowered and neither Node 26 nor Chrome 152 parse them. axe found no violations in either prototype.

## Decision

User decision, 2026-10-15.

- **Port Timeless's approach** into @lumiose/ui instead of depending on it or merging it: light-DOM custom elements only where the platform falls short, native `<dialog>`, popover, invoker commands and CSS anchor positioning, CSS in cascade layers (`lu.tokens`, `lu.core` for required behaviour, `lu.theme` for the replaceable look, so unlayered app CSS wins), and APG keyboard contracts. Timeless stays the user's separate project and the reference; its own gaps (U1 to U5) went to https://github.com/itsjavi/timeless/issues/16.
- **Custom element tags** use the `lu-` prefix (`lu-menu`, `lu-combobox`).
- **DOM events** are lowercase like native ones: `openchange`, `checkedchange` and `change` (the combobox fires `change` like a native control). Components expose them as `onOpenChange`, `onCheckedChange` and `onValueChange`.
- **Part anatomy** follows Base UI where the platform allows: Dialog `Root`, `Trigger`, `Popup`, `Title`, `Description`, `Close`; Menu `Root`, `Trigger`, `Popup`, `Item`, `CheckboxItem`, `Separator`; Combobox `Root`, `Label`, `Input`, `List`, `Item`. No `Portal`, `Positioner` or `Backdrop`: the top layer, anchor positioning and `::backdrop` replace them; placement props go on `Popup`.
- **An alert dialog** is `role="alertdialog"` on `Dialog.Root`, not a separate component.
- **No part attribute:** parts are styled through class props and native or ARIA state (`dialog[open]`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`, `[aria-selected]`), plus `data-highlighted` on the active option.
- **`bind:` on components and custom elements** (a syntax decision): `bind:x` works on any component with an `x` prop and an `onXChange` callback, and on a custom element with an `x` property and a change event, like `bind:value` on inputs.
- Rejected: depending on Timeless, merging it, the `lumiose-` and `l-` prefixes, `lu-`-prefixed events, a separate `AlertDialog`, a `data-part` attribute, explicit props without `bind:`.

## Consequences

- M12 implementation tasks: TASK-353 (package), TASK-354 (element definitions on server-rendered pages), TASK-355 to TASK-359 (dialog, popover and tooltip, menu, combobox and select, tabs), TASK-360 (`bind:` on components), TASK-361 (test kit), TASK-362 (docs and adoption), TASK-363 (remove examples/ui-spike). The spike's Lumiose findings are TASK-346 to TASK-349.
- @lumiose/ui keeps its own 0.x versions (decision-54, TASK-333).
