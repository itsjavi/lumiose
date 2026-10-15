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

- **Port Timeless's approach** into @lumiose/ui instead of depending on it or merging it: light-DOM custom elements only where the platform falls short, native `<dialog>`, popover, invoker commands and CSS anchor positioning, and APG keyboard contracts. Timeless stays the user's separate project and the reference; its own gaps (U1 to U5) went to https://github.com/itsjavi/timeless/issues/16.
- **Unstyled** (user, 2026-10-15, amending the spike's theme tiers): the package ships only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, the CSS variables components expose) in one low-priority cascade layer, so any app CSS wins. Prebuilt themes ship separately and opt-in (user, 2026-10-15): `@lumiose/ui/themes/default.css`, based on the spike port's styles with a typical blue primary, for demos, getting started and the UI docs. Themes are driven by CSS custom properties with shadcn's names and the `--lu-` prefix (`--lu-background`, `--lu-foreground`, `--lu-primary`, `--lu-primary-foreground`, `--lu-muted`, `--lu-accent`, `--lu-destructive`, `--lu-border`, `--lu-input`, `--lu-ring`, `--lu-radius` and their pairs), with light and dark, in a layer above the required CSS so app CSS still wins.
- **Scope** (user, 2026-10-15): parity with Base UI's components before @lumiose/ui 1.0 (Base UI 1.9.0: Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible, Combobox, Context Menu, Dialog, Drawer, Field, Fieldset, Form, Input, Menu, Menubar, Meter, Navigation Menu, Number Field, OTP Field, Popover, Preview Card, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar, Tooltip), with right-to-left support read from the DOM's `dir`.
- **Verification** (user, 2026-10-15): every primitive is checked against Base UI's and Zag/Ark's behaviour through the "UI primitives pitfall checklist" backlog doc before it is Done, and Prism reviews @lumiose/ui against both before each release.
- **Custom element tags** use the `lu-` prefix (`lu-menu`, `lu-combobox`).
- **DOM events** are lowercase like native ones: `openchange`, `checkedchange` and `change` (the combobox fires `change` like a native control). Components expose them as `onOpenChange`, `onCheckedChange` and `onValueChange`.
- **Part anatomy** follows Base UI where the platform allows: Dialog `Root`, `Trigger`, `Popup`, `Title`, `Description`, `Close`; Menu `Root`, `Trigger`, `Popup`, `Item`, `CheckboxItem`, `Separator`; Combobox `Root`, `Label`, `Input`, `List`, `Item`. No `Portal`, `Positioner` or `Backdrop`: the top layer, anchor positioning and `::backdrop` replace them; placement props go on `Popup`.
- **An alert dialog** is `role="alertdialog"` on `Dialog.Root`, not a separate component.
- **Native gaps are closed by small scripts** (user, 2026-10-15): where native elements differ from Base UI's behaviour (for Dialog: secondary-button dismissal, nested state, touch focus, focus return with `preventScroll`, Safari light dismiss, invoker commands in older browsers), the component keeps working without JavaScript and a small script shipped through `?client` (decision-63) when it renders closes the gap.
- **No part attribute:** parts are styled through class props and native or ARIA state (`dialog[open]`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`, `[aria-selected]`), plus `data-highlighted` on the active option.
- **`bind:` on components and custom elements** (a syntax decision): `bind:x` works on any component with an `x` prop and an `onXChange` callback, and on a custom element with an `x` property and a change event, like `bind:value` on inputs.
- Rejected: depending on Timeless, merging it, the `lumiose-` and `l-` prefixes, `lu-`-prefixed events, a separate `AlertDialog`, a `data-part` attribute, explicit props without `bind:`.

## Consequences

- M12 implementation tasks: TASK-353 (package), TASK-354 (element definitions on server-rendered pages), TASK-355 to TASK-359 (dialog, popover and tooltip, menu, combobox and select, tabs), TASK-360 (`bind:` on components), TASK-361 (test kit), TASK-362 (docs and adoption), TASK-363 (remove examples/ui-spike). The spike's Lumiose findings are TASK-346 to TASK-349. Parity tasks: TASK-364 to TASK-385; the release review: TASK-386.
- @lumiose/ui keeps its own 0.x versions (decision-54, TASK-333).
