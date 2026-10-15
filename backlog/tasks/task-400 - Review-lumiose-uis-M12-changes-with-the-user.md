---
id: TASK-400
title: Review @lumiose/ui's M12 changes with the user
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 19:52'
updated_date: '2026-10-15 23:25'
labels:
  - ui
  - review
milestone: m-12
dependencies: []
priority: high
ordinal: 399000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request, 2026-10-15: start M12 worker batches autonomously, and review the full UI changes together at the end. Lux records here, batch by batch, the public names the workers propose (still proposals until the user approves them; AGENTS.md) and the UI changes worth the user's look, with the showcase page or screenshot for each. Already approved on 2026-10-15: the names from TASK-356, 357, 359, 390 and 393 (decisions 62, 64 and 65).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every proposed public name from the later batches is listed with its task
- [ ] #2 The user reviewed the list and the showcase, and the approved names are recorded in the decisions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Batch 3 (2026-10-15): TASK-358, 396, 391, 387

**Proposed public names (awaiting the user's review):**
- **TASK-358 Combobox:**
  - parts `Trigger`, `Clear`, `Chips`, `Popup`, `Group`, `GroupLabel`, `Empty`, `Status` (Base UI's names);
  - props `multiple`, `filter` (`"contains" | "startsWith" | "none"`), `name`, `required`, `disabled`, `open`/`onOpenChange`/`bind:open` on Root, `label`/`disabled` on Item, `removeLabel` on Chips;
  - type `ComboboxValue`;
  - custom commands `--toggle` and `--clear`;
  - element attribute `filter` and `data-remove-label` on the chips list;
  - ids `<id>-chips` and `<id>-empty`.
- **TASK-358 Select:** parts `Root`, `Trigger`, `Value`, `Item`, `Group` (`label`) and `Separator`.
- **TASK-358, both:** theme classes `lu-combobox` and `lu-select`; exports `/combobox`, `/combobox.css`, `/select` and `/select.css`.
- **TASK-387 site:**
  - URL paths `/ui` (Introduction) and `/ui/<page>`, with `/docs/ui/*` redirecting to them;
  - the header link "UI" and the footer link "UI components";
  - demos are the existing `tsx check` examples, with no new convention in packages/ui/docs.

**Worth the user's look:**
- the site's /ui section (live demos, Installation and Theming pages);
- Combobox and Select in the showcase (/combobox, /select and their island pages);
- the shared dismissal model across Menu, Popover and Combobox (TASK-396).

## Batch 4 (2026-10-15): TASK-365 to 368 (Halo), TASK-370 and 371 (Beacon)

**Proposed public names (for the user's review):**

- **Field:**
  - parts `Root`, `Label`, `Control`, `Description`, `Error`;
  - props `name`, `disabled`, `invalid`, `validationMode` (`onSubmit`/`onBlur`/`onChange`) and `validate`, plus Error `match`;
  - types `FieldValidate`, `FieldErrorMatch`, `ValidationMode`;
  - the `lu-field` element and its `validation-mode` attribute;
  - derived ids `-control`, `-label`, `-description`, `-error`, `-error-invalid`, `-error-always`, `-error-<key>`.
- **Fieldset:** `Root`, `Legend`.
- **Form:** `errors`, `validationMode`; type `FormErrors`.
- **Input:** `value`, `defaultValue`, `onValueChange`.
- **Checkbox:** `checked`, `defaultChecked`, `onCheckedChange`, `indeterminate`, `value`, `parent`, `readOnly`; attributes `data-indeterminate` and `data-parent`.
- **CheckboxGroup:** `value`, `defaultValue`, `onValueChange`, `allValues`, `name`.
- **RadioGroup:** `value`, `defaultValue`, `onValueChange`, `name`, `required`, `readOnly`. **Radio.Root:** `value`. The docs page is titled "Radio".
- **Switch:** `checked`, `defaultChecked`, `onCheckedChange`, `value`, `readOnly`.
- **Theme classes (form controls):** `lu-field`, `lu-input`, `lu-fieldset`, `lu-checkbox`, `lu-radio`, `lu-switch`.
- **Exports (form controls):** `/field`, `/field.css`, `/fieldset`, `/form`, `/input`, `/checkbox`, `/checkbox-group`, `/radio-group`, `/switch`.
- **Fixture:** the `UI_E2E_PORT` environment variable for the ui-e2e servers.
- **Collapsible, Accordion and Toast:**
  - exports `Collapsible`, `Accordion`, `Toast` and a named `createToastManager` (named because of TASK-401);
  - entries `/collapsible`, `/accordion`, `/toast` and their `.css` files;
  - elements `lu-accordion` and `lu-toast-viewport`;
  - CSS variables `--collapsible-panel-height`, `--accordion-panel-height`, `--toast-index` and `--toast-swipe-movement-x/-y`;
  - the `data-*` attributes listed in TASK-370 and TASK-371;
  - the toast's `close` event, the `--close-toast` command and the "Notifications (F6)" label;
  - theme classes `lu-collapsible`, `lu-accordion`, `lu-toast-viewport`, `lu-toast`.

**Worth the user's look:**

- How Field shows the browser's validation messages inside the field.
- Toast in a modal dialog: the region moves into the topmost dialog.
- `Accordion.Header` puts its `<h3>` inside `<summary>`. Screen readers are not yet verified.
- Without JavaScript, a server-rendered toast stays until the next page.

**Bugs found and filed:**

- TASK-403: a hydration bug.
- TASK-401: a false LUM2001.
- TASK-402: selector hoisting.

## Batch 5 (2026-10-16): TASK-364, 369, 372, 373 (Halo), TASK-403, 378, 382 (Beacon)

**Proposed public names (for the user's review):**
- **Button, Toggle, Progress, Meter and Slider:**
  - components: `Button` with `focusableWhenDisabled`, `Toggle`, `ToggleGroup`, `Progress`, `Meter`, `Slider` and `SliderValue`;
  - elements: `lu-toggle-group` (events `pressedchange` and `valuechange`) and `lu-slider` (attributes `large-step`, `min-steps-between-values` and `thumb-collision-behavior`);
  - CSS variables: `--lu-value`, `--lu-slider-start` and `--lu-slider-end`;
  - theme classes: `lu-toggle`, `lu-toggle-group`, `lu-progress`, `lu-meter` and `lu-slider`;
  - the full lists are in each task's notes.
- **Context Menu:**
  - `ContextMenu` with Base UI's parts, including `LinkItem`;
  - entries `/context-menu` and `/context-menu.css`;
  - the `lu-context-menu` element, with `data-disabled`;
  - the variables `--lu-context-x` and `--lu-context-y`;
  - `<lu-menu>`'s `show(keyboard)` method.
- **Drawer:**
  - `Drawer` with the parts Root, Trigger, Popup, Content, Title, Description and Close;
  - the `swipeDirection` prop and the `DrawerSwipeDirection` type;
  - entries `/drawer` and `/drawer.css`;
  - the attributes `data-swipe-direction`, `data-swiping`, `data-swipe-dismiss` and `data-swipe-ignore`;
  - the variables `--drawer-swipe-movement-x`, `--drawer-swipe-movement-y` and `--drawer-swipe-progress`;
  - the theme class `lu-drawer`.

**Worth the user's look:**
- A Toggle on its own needs an island to change state; in a ToggleGroup it works on server pages.
- Without its script, a `focusableWhenDisabled` button still acts.
- Drawer leaves out Base UI's snap points, swipe area, indent effects, virtual-keyboard provider, detached triggers and non-modal drawers.
- Context Menu opens on long press (iOS sends no contextmenu event) and on Shift+F10 or the ContextMenu key.
- TASK-403, the hydration bug, was dev-only: hot reloading delayed a component's first render. It is fixed in `dom/hot.ts`.

**Filed:** TASK-407 (the runtime's `value` property), plus the Slider gaps against Base UI.
<!-- SECTION:NOTES:END -->
