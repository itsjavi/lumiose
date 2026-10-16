---
id: TASK-400
title: Review @lumiose/ui's M12 changes with the user
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 19:52'
updated_date: '2026-10-16 05:22'
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

## Batch 6 (2026-10-16): TASK-375, 377, 404, 394 (Halo); TASK-407, 401, 402, 406, 374 (Beacon)

**Proposed public names (for the user's review):**
- **Number Field:**
  - `NumberField` with the parts `Root`, `Group`, `Input`, `Increment`, `Decrement` and `ScrubArea`, plus their `*Props` types;
  - the `lu-number-field` element, with the attributes `min`, `max`, `step`, `large-step`, `format`, `locale`, `allow-wheel-scrub` and `allow-out-of-range`;
  - the entries `/number-field` and `/number-field.css`.
- **Autocomplete:**
  - `Autocomplete`, `AutocompleteRootProps`, `AutocompleteMode` and eleven part `*Props` types;
  - new `lu-combobox` attributes `free`, `inline` and `open-on-input-click`;
  - the entries `/autocomplete` and `/autocomplete.css`.
- **Popover:** `modal` on Root; `openOnHover`, `delay` and `closeDelay` on Trigger.
- **Separator:** `Separator` with `orientation`, and the types `SeparatorProps` and `SeparatorOrientation`.
- **Avatar:**
  - `Avatar` with the parts `Root`, `Image` and `Fallback`, and the type `AvatarLoadingStatus`;
  - the `lu-avatar` element with a `status` property;
  - the event `loadingstatuschange` and the prop `onLoadingStatusChange`;
  - the attributes `data-orientation`, `data-loading`, `data-error`, `data-loaded` and `data-fallback`;
  - the variable `--lu-avatar-delay`.
- **Theme classes:** `lu-separator`, `lu-avatar` and `lu-number-field`.
- **Entries:** `/separator`, `/separator.css`, `/avatar` and `/avatar.css`.

**Changes to earlier proposals:** the named `createToastManager` export is gone. TASK-401 fixed the false LUM2001, so `Toast.createToastManager()` is the only API, as in Base UI.

**Worth the user's look:**
- **Number Field with `format`:** without JavaScript it submits the typed text, not the parsed number.
- **Popover `modal`:** the popup is a modal `<dialog>` anchored to its trigger.
- **The site's a11y suite:** it exempts `progress:indeterminate` from its 5-second motion limit, as an activity indicator that stops under reduced motion. This is a policy choice.
- **Headings in the site's docs prose:** they now wrap anywhere, for 320px with text spacing.

**Filed:** TASK-410 (gaps against Base UI) and TASK-411 (getter rule for custom elements).

## Batch 7 (2026-10-16): TASK-376, 381, 383, 384 (Halo); TASK-379, 380, 411, 363 (Beacon)

**Proposed public names (for the user's review):**
- **OTP Field:**
  - `OTPField` (`Root`, `Input`, `Slot`, `Separator`) with its `*Props` types and `OTPFieldValidationType`;
  - the `lu-otp-field` element, with the `valuecomplete` and `valueinvalid` events;
  - the `data-slot` and `data-active` attributes.
- **Preview Card:** `PreviewCard` (`Root`, `Trigger`, `Popup`), with `data-preview-card` and `data-popup-open`.
- **Toolbar:**
  - `Toolbar` (`Root`, `Button`, `Link`, `Input`, `Group`, `Separator`);
  - the `lu-toolbar` element, with `data-toolbar-item`.
- **Scroll Area:**
  - `ScrollArea` (`Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`, `Corner`);
  - the `lu-scroll-area` element and its overflow attributes;
  - the `--lu-scroll-area-*` variables. Base UI names them `--scroll-area-*`.
- **Menubar:**
  - `Menubar`, with `orientation` and `loopFocus`;
  - the `lu-menubar` element, with `data-has-submenu-open` and `data-loop-focus`;
  - Menu's new `MenubarContext` and `MenubarContextValue` exports.
- **Navigation Menu:**
  - `NavigationMenu` (`Root`, `List`, `Item`, `Trigger`, `Icon`, `Content`, `Link`);
  - the `lu-navigation-menu` element, with `value` and `valuechange`;
  - the attributes `data-activation-direction`, `data-active`, `data-close-on-click`, `data-delay` and `data-close-delay`.
- **Theme classes:** `lu-otp-field`, `lu-preview-card`, `lu-toolbar`, `lu-scroll-area`, `lu-menubar`, `lu-navigation-menu`.
- **Package entries:** one per component, plus a `.css` entry for each.

**Worth the user's look:**
- **OTP Field:** one native input under visual slots, not one input per character. This trades for SMS autofill, behaviour without JavaScript, and one labelled field for screen readers; the slots need the script.
- **Navigation Menu:** it has no shared Viewport, because a shared resizing box needs a portal. Each panel slides in from its trigger's side.
- **Preview Card:** it is reachable with the keyboard, unlike Base UI's.
- **Scroll Area:** without JavaScript it falls back to native scrollbars.
- **TASK-411:** the rule for `lu-` element getters is in @lumiose/ui's README, with a test.
- **TASK-363:** examples/ui-spike is removed.

**Filed:**
- TASK-413: gaps against Base UI;
- TASK-414: the ui-e2e nav;
- TASK-412 (`useId` inside `Dynamic`): assigned to Spark.

## Batch 8 (2026-10-16): hardening (Halo: TASK-414, 385, 395, 405, 408, 410, 413; Beacon: TASK-412, 388, 409, 397, 399, 398, 362, 361)

**Proposed public names (for the user's review; most are Base UI's own names):**
- Tabs: `Tabs.Indicator`, with `data-indicator` and the `--lu-tabs-anchor` variable.
- Field: `validationDebounceTime` and `Field.Validity`; `validate` may be async.
- Checkbox and Switch: `uncheckedValue` (`data-unchecked-value`).
- Slider: `thumbCollisionBehavior="swap"`, `thumbAlignment` (`"edge" | "center"`, `data-thumb-alignment`), `--lu-slider-thumb-size`.
- Number Field: `smallStep`, `snapOnStep`.
- Autocomplete: `autoHighlight`, `keepHighlight`, `submitOnItemClick`, `limit`.
- Popover: `modal="trap-focus"` (`data-trap-focus`).
- OTP Field: `normalizeValue`.
- Test kit: the `test:e2e:browsers` script, the `UI_E2E_BROWSERS` and `UI_E2E_WS` variables, and the `ui-browsers` CI workflow, which runs Firefox and WebKit on Linux when UI paths change.
- site-kit: its `Tabs` API changes to `Tabs.Root/List/Tab/Panel`, since it now uses @lumiose/ui.

**Dropped, with reasons in the tasks:** CheckboxGroup `required` (Base UI has none, and HTML has no "at least one" constraint); Number Field `ScrubAreaCursor`; Popover Backdrop (`::backdrop` covers it); Preview Card Arrow, Backdrop and detached triggers.

**Decisions for the user:**
- **Screen reader pass (TASK-361):** VoiceOver and NVDA need a person. The checklist is in TASK-361's notes. TASK-361 stays open until then.
- **Tooltips on ThemeToggle and CopyButton (site-kit):** keep the native `title`, or switch to the ui Tooltip at about 1.5 kB per page.

**Worth the user's look:** RTL across every component (TASK-385, no `:dir()` left in @lumiose/ui's CSS); the Firefox and WebKit runs found real bugs and fixed them (Menu and Combobox resting-pointer detection, Toast swipes).

**Filed or assigned:**
- Halo: TASK-416 to TASK-420 (Firefox and WebKit issues).
- Spark: TASK-415 (dev-only hydration).
- Beacon: TASK-421 (DocsSearch), TASK-423 (docs demos with function props).
- Photon: TASK-422 (`:dir()` in production CSS).

## Batch 9 (2026-10-16): browser fixes (Halo: TASK-424, 416 to 420; Beacon: TASK-415, 422, 423, 421)

**No new public names.** Firefox and WebKit pass with no new skips. Halo's run of ui-e2e across all four projects passed 1608 tests.

**Worth the user's look:**
- **Production CSS:** @lumiose/vite now sets `build.cssTarget` to Baseline widely available (Chrome and Edge 123, Firefox 124, Safari 17.4), so `:dir()`, nesting and other modern CSS survive minification for every app. A project's own target still wins. Recorded in decision-66.
- **TASK-415:** turned out to be a compiler bug that affected builds too. A fragment with a single dynamic item now compiles to an `insertValue` range.
- **Site search:** DocsSearch runs on @lumiose/ui's Autocomplete. Its results list is named "Search the docs".
- **Radio Group and Slider:** both now handle their own arrow keys, so right-to-left works the same in every browser.
<!-- SECTION:NOTES:END -->
