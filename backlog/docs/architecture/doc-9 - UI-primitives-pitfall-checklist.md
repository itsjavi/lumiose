---
id: doc-9
title: UI primitives pitfall checklist
type: specification
created_date: '2026-10-15 17:11'
updated_date: '2026-10-15 17:11'
---
# UI primitives pitfall checklist

What Base UI and Zag/Ark already handle and a native-first implementation tends to miss. Every @lumiose/ui primitive passes the items that apply to it before its task is Done (decision-62), and Prism's review before each release (TASK-386) updates this list.

**Sources.** Read on 2026-10-15:
- **Base UI (BU):** `master` @ fa85f79. Paths below are under https://github.com/mui/base-ui/blob/master/packages/
- **Zag (Z):** `main` @ 055a34f. Paths below are under https://github.com/chakra-ui/zag/blob/main/. Ark components wrap Zag machines, so the behaviour lives in Zag.

Browser support figures come from caniuse/MDN as of 2026-10-15. Anything not confirmed is marked **(unverified)**.

## 0. Native support (Oct 2026)

| Feature | Chrome | Firefox | Safari |
|---|---|---|---|
| Invoker commands | 135 | 144 | 26.2 |
| `dialog[closedby]` | 134 | 141 | Technology Preview only |
| `CloseWatcher` | 126 | 149 | Technology Preview only |
| `popover="hint"` | 151 (partial from 133) | 153 (partial from 149) | no |
| `interestfor` | 142 | no | no |
| `showPopover({source})` | 137 | 144 | 26 |
| Anchor positioning | 125 | 147 | 26 partial, 27 full |
| `position-visibility` | 125 | 147 | 26.2 |
| Customizable select | 135 | no | 27 (caniuse; verify) |
| `overlay` (top-layer exit transitions) | 117 | no | no |
| `interpolate-size` | 129 | no | no |
| `::details-content` | 131 | 143 | 18.4 |
| `hidden="until-found"` | yes | yes | 26.2 (Baseline Dec 2025) |
| `<input switch>` | no | no | 17.4 |

Refs:
- caniuse: [closedby](https://caniuse.com/mdn-html_elements_dialog_closedby), [hint](https://caniuse.com/mdn-html_global_attributes_popover_hint), [interest invokers](https://caniuse.com/wf-interest-invokers), [anchor positioning](https://caniuse.com/css-anchor-positioning), [customizable select](https://caniuse.com/selectlist), [overlay](https://caniuse.com/mdn-css_properties_overlay)
- [WebKit 26.2 notes](https://webkit.org/?p=17640)

## 1. Cross-cutting

**Layers and dismissal**
- [ ] Escape and outside press act only on the topmost layer. One Escape closes one layer (Z `packages/utilities/dismissable/src/layer-stack.ts`; BU test "dismisses non-nested dialogs one by one").
  - Native close watchers and the popover stack only do this for native layers.
  - A JS-managed layer (for example an inline combobox list inside a `<dialog>`) must `preventDefault()` the Escape `keydown`. The spec fires that cancelable keydown before the close request.
- [ ] Opening a second, non-nested modal does not dismiss the first.
- [ ] A press inside a child layer (menu, select, nested popover) does not dismiss the parent. Neither does a press that starts inside and ends outside.
  - Native popover ancestry comes only from DOM nesting or from the invoker/`source`. A child placed elsewhere with neither makes its parent light-dismiss.
- [ ] Clicking a toast or another persistent element does not dismiss an open popover or dialog (Z `e2e/toast.e2e.ts`, "interacting with toast does not close dialog"; `persistentElements`). Native `popover=auto` light dismiss *will* close it.
- [ ] Outside-press filters (Z `packages/utilities/interact-outside/src/index.ts`; BU DialogRoot tests):
  - main button only, no right-click;
  - no multi-touch;
  - no presses on scrollbars;
  - no targets already removed from the DOM;
  - no password-manager overlays inside the popup's rect.
- [ ] Backdrop dismissal happens on click, not mousedown.
  - Native `closedby=any` and popover light dismiss need pointerdown and pointerup on the same target, which covers the drag-out case.
  - Native handling of right-click **(unverified)**.
- [ ] Safari and Firefox on macOS do not focus a pressed button (BU `react/src/dialog/popup/DialogPopup.test.tsx` comment; Z interact-outside comment).
  - Focusout-based dismissal therefore races with pointer handling.
  - The native "previously focused element" may be `<body>`, so test focus return in WebKit.

**Modality, inert and the top layer**
- [ ] Per the spec, a modal dialog makes everything outside itself and its flat-tree descendants inert. That includes top-layer popovers and toasts that are not its DOM children ([spec](https://html.spec.whatwg.org/multipage/interaction.html), [whatwg/html#9936](https://github.com/whatwg/html/issues/9936) still open).
  - Inert content cannot be focused and is hidden from assistive technology, so a toast outside the dialog can be neither used nor announced ([htmhell 2025/1](https://htmhell.dev/adventcalendar/2025/1)).
  - BU `markOthers.ts` and Z `aria-hidden/src/walk-tree-outside.ts` skip `[aria-live]` regions.
  - Render popups that open from a dialog inside it.
  - Test with real Playwright input: a programmatic `el.click()` bypasses inert.
- [ ] `showModal()` hides open auto popovers up to the dialog's topmost popover ancestor. A menu item that opens a dialog therefore closes its menu, and on dialog close focus must go to the menu or select trigger (BU DialogPopup test "returns focus to the $name trigger").
- [ ] The Android back gesture is a close request.
  - `cancel` is only cancelable with history-action activation, so a second Escape closes the dialog even if `cancel` is prevented ([close watchers](https://html.spec.whatwg.org/multipage/interaction.html), [Judis](https://www.stefanjudis.com/blog/risky-mobile-close-requests/)).
  - A dialog that must not close needs `closedby="none"`, which Safari lacks.

**Scroll lock**
- [ ] A native modal `<dialog>` does not lock page scroll.
- [ ] Locks are ref-counted across layers.
- [ ] If the page is already locked by something else, wait for that lock to clear instead of snapshotting the locked state (BU uses a MutationObserver).
- [ ] Lock `<html>` when it is the scroller, otherwise `<body>`.
- [ ] Avoid layout shift:
  - use `scrollbar-gutter: stable` when it is supported (BU feature-tests it);
  - otherwise pad by the scrollbar width (Z uses `paddingLeft` in RTL and sets `--scrollbar-width`).
- [ ] iOS: `overflow:hidden` is not enough.
  - Z pins `<body>` with `position:fixed` and restores the scroll position afterwards.
  - BU uses the overflow-only path on iOS and skips locking under WebKit pinch-zoom.
- [ ] Touch-opened anchored popups do not lock scroll, so the user can swipe outside to dismiss. The exception is a popup that is effectively full width, within a 20px gutter (BU `react/src/utils/useAnchoredPopupScrollLock.ts`).

Refs: BU `utils/src/useScrollLock.ts`; Z `packages/utilities/remove-scroll/src/index.ts`, `e2e/scroll-lock.e2e.ts`.

**Focus, input and infrastructure**
- [ ] Return focus with `preventScroll`.
  - Skip it when the outside press landed on a focusable element (Z popover `setFinalFocus`).
  - Fall back to the previous element if the trigger has unmounted (BU).
  - Native popovers restore focus only when focus was inside them, and never on light dismiss.
- [ ] Scrolling a list with the keyboard under a stationary pointer fires `pointermove` (in WebKit, a zero-delta `mousemove`). Ignore it unless the modality is pointer (Z select/combobox/menu; BU `react/src/floating-ui-react/hooks/useListNavigation.webkit.test.tsx`).
- [ ] Ignore Enter and arrow keys while `isComposing` (IME).
- [ ] Animations:
  - stay mounted until `getAnimations()` settle (BU `data-ending-style`, Z presence);
  - no enter animation on content rendered open;
  - an interrupted open or close still completes correctly.
- [ ] Native exit animations: `overlay` is Chromium-only. In Firefox and Safari the element leaves the top layer when the exit starts, so the backdrop and stacking jump.
- [ ] Ids and server rendering:
  - generate deterministic ids;
  - never reference ids that are not rendered (BU "does not link Select.Label before hydration");
  - an open popover or modal cannot be server-rendered, because it needs `showPopover`/`showModal`;
  - pre-hydration scripts need the CSP nonce (BU tabs indicator, slider thumbs).
- [ ] Safari VoiceOver needs about 200ms to pick up live-region text that was present at insertion. BU adds a Word Joiner mutation (`react/src/internals/useInitialLiveRegionTextMutation.ts`).
- [ ] RTL swaps horizontal arrow keys (tabs, radio, toggle group, slider, submenu keys) and logical placement sides.

## 2. Dialog and Alert Dialog
- [ ] Initial focus goes to the first tabbable element. When the dialog was opened by touch, BU focuses the popup itself so the virtual keyboard does not open (`react/src/utils/popups/popupStoreUtils.ts`).
  - Native order: `autofocus`, then the first sequentially focusable descendant in tree order, then the dialog. There is no touch case.
  - Chrome's focusable scrollers may become that target **(unverified)**.
- [ ] Alert dialog: `role=alertdialog`, no outside-press dismissal, Escape still closes (Z `closeOnInteractOutside: modal && !alertDialog`; BU "does not close when the backdrop is clicked"). Z focuses the close trigger first.
- [ ] `aria-labelledby` and `aria-describedby` track Title and Description, including when those parts change. The trigger has `aria-haspopup=dialog` and `aria-expanded`.
- [ ] Modal: the page is inert and Tab cycles inside, including under a `display:contents` wrapper.
- [ ] Nested dialogs:
  - Escape closes only the child;
  - the parent gets `data-nested-dialog-open` and a nested-count CSS variable;
  - dismissing a nested menu or select keeps the dialog open.
- [ ] A backdrop hit reports the dialog as its target, so the spec's `closedby=any` uses a bounds check. A Safari JS fallback must do the same.

Refs:
- BU: `react/src/dialog/root/DialogRoot.test.tsx`, `react/src/dialog/popup/DialogPopup.test.tsx`, `react/src/alert-dialog/root/AlertDialogRoot.test.tsx`
- Z: `packages/machines/dialog/src/dialog.machine.ts`, `e2e/dialog.e2e.ts`
- [Dialog spec](https://html.spec.whatwg.org/multipage/interactive-elements.html)

## 3. Popover
- [ ] Non-modal Tab order (Z `e2e/popover.e2e.ts`):
  - Tab out of the popup moves to the element after the trigger;
  - Shift+Tab from the start returns to the trigger;
  - when the trigger is the last tabbable element, Tab does not loop back into the popup.
  - Natively, an invoker-shown popover is scoped under its invoker; verify JS-opened popovers.
- [ ] Opening by click moves focus to the first focusable element (Z `autoFocus`). Opening by hover does not (BU). Native `showPopover` focuses only an `autofocus` element.
- [ ] Hover opening: open and close delays, a safe polygon (BU `react/src/floating-ui-react/safePolygon.ts`), a click before the delay keeps it open, and a hover-opened popup becomes modal once clicked.
- [ ] Modal variant: focus trap, scroll lock and inert page.
- [ ] Anchoring:
  - the invoker acts as the implicit anchor (Safari's gap is fixed);
  - Safari and Firefox don't follow a `transform`ed anchor ([WebKit 309921](https://bugs.webkit.org/show_bug.cgi?id=309921));
  - hide the popup when the anchor is clipped (`position-visibility`, BU hide middleware);
  - RTL logical alignment.

Refs: BU `react/src/popover/root/PopoverRoot.test.tsx`; Z `packages/machines/popover/src/popover.machine.ts`.

## 4. Tooltip
- [ ] Opens on hover or on keyboard focus only (Z checks focus-visible). Never opens from touch (both libraries).
- [ ] A press before the open delay cancels opening.
- [ ] Closes on Escape, on trigger click (configurable), on blur, on pointerdown, and on ancestor scroll (Z `closeOnScroll`).
- [ ] The popup itself is hoverable (WCAG 1.4.13), with an opt-out.
- [ ] Only one tooltip is open at a time. Within the group window, the next one opens without delay.
- [ ] Hovering a nested trigger does not open the outer tooltip.
- [ ] The two libraries use different accessibility models; pick one and assert the trigger's accessible name and description.
  - BU treats tooltips as visual only, so the trigger needs its own `aria-label` ([docs](https://base-ui.com/react/components/tooltip)).
  - Z sets `role=tooltip` and `aria-describedby` only while open.
- [ ] Native: `popover=hint` (no Safari) and `interestfor` (Chromium only) need a JS fallback everywhere else. How `interestfor` maps to ARIA, and long-press on touch, are **(unverified)**.

Refs: BU `react/src/tooltip/root/TooltipRoot.test.tsx`; Z `packages/machines/tooltip/src/tooltip.connect.ts`, `e2e/tooltip.e2e.ts`.

## 5. Menu, submenus, checkbox and radio items
- [ ] Opening keys: Enter, Space and ArrowDown open the menu and focus the first item; ArrowUp focuses the last.
- [ ] Navigation: Home/End, optional looping. Tab closes the menu and moves on; Shift+Tab closes it and focuses the trigger.
- [ ] Typeahead:
  - resets after 750ms in BU and 350ms in Z;
  - matches the item's `label`;
  - skips CSS-hidden and natively disabled items;
  - Space during typeahead is typed text, not an activation.
- [ ] Items with `aria-disabled` can still be highlighted but do not activate (BU).
- [ ] Pointer:
  - press-drag-release from the trigger selects an item;
  - a mouseup too soon after opening does not;
  - pointer leave clears the highlight.
- [ ] Submenu keyboard: ArrowRight, Enter or Space opens it (ArrowLeft in RTL). ArrowLeft closes it and refocuses its trigger.
- [ ] Submenu hover: delayed open, and an intent polygon keeps it open during diagonal moves across sibling items.
- [ ] Submenu dismissal: an outside press closes the whole tree. Escape closes one level by default (BU `closeParentOnEsc=false`).
- [ ] Checkbox and radio items:
  - roles `menuitemcheckbox`/`menuitemradio` with `aria-checked`, radio items inside `role=group`;
  - Space and Enter toggle;
  - they stay open by default (BU `closeOnClick=false`).
- [ ] Link items: Cmd/Ctrl/middle-click and download clicks must not select or close the menu (Z). Enter must dispatch a real click (BU `dispatchClickWithModifiers`).
- [ ] Context menu: iOS fires no `contextmenu` on long press. Use a long-press timer that cancels on move or multi-touch, plus `-webkit-touch-callout:none` (Z `getContextTriggerProps`).
- [ ] Scroll lock applies when the menu is opened by mouse, but not by touch unless it is full width.
- [ ] Native `popover=auto` covers only light dismiss, Escape and the top layer. Roving focus, typeahead and submenu intent need JS.

Refs: BU `react/src/menu/root/MenuRoot.test.tsx`; Z `packages/machines/menu/src/menu.machine.ts`, `e2e/menu-nested.e2e.ts`, `e2e/menu-option.e2e.ts`.

## 6. Combobox
- [ ] The input has `role=combobox` with `aria-expanded`, `aria-controls`, `aria-autocomplete` (list or both) and `aria-activedescendant`. Focus never leaves the input: call `preventDefault` on listbox pointerdown.
- [ ] While composing (IME), Enter does not commit and arrow keys do not move the highlight.
- [ ] Escape closes without committing. When the list is empty or hidden, Escape bubbles so a parent dialog can close.
- [ ] Tab closes the popup.
- [ ] Closing without a selection restores the input text.
- [ ] Clearing the text clears a single selection.
- [ ] Reopening highlights the first selected item.
- [ ] Status and empty messages are announced (mind the VoiceOver delay).
- [ ] Browser autofill does not close the popup or commit unmatched values.
- [ ] In multiple mode, each value gets its own hidden input.
- [ ] There is no native equivalent: `<datalist>` is too limited, and customizable select cannot filter.

Refs: BU `react/src/combobox/root/ComboboxRoot.test.tsx`; Z `packages/machines/combobox/src/combobox.connect.ts`, `e2e/combobox.e2e.ts`.

## 7. Select
- [ ] The trigger has `role=combobox` in both libraries. Clicking the label focuses the trigger without opening it.
- [ ] Opening with the keyboard highlights the selected item.
- [ ] Typeahead on the closed trigger commits a value (BU), skips disabled matches, and cycles on a repeated letter.
- [ ] Drag-to-select works. A quick mouseup, a mouseup after touch, or a disabled item does not select. The trigger-aligned mode closes on window resize.
- [ ] Form integration:
  - a hidden `<select>` or input carries `name` and `autocomplete`, and is `required` only when empty;
  - autofill flows back into state;
  - the hidden select forwards focus to the trigger (Z);
  - form `reset` restores the initial value and `fieldset[disabled]` disables the control (Z `packages/utilities/dom-query/src/form.ts`).
- [ ] Inside nested dialogs, the list stacks on top and Escape closes select, then child, then parent (Z `e2e/select-nested-dialog.e2e.ts`).
- [ ] Customizable select covers typeahead, forms, reset, autofill and the anchored top-layer picker.
  - Gaps: Firefox has none, Safari only from 27, and there is no trigger-aligned mode.
  - `multiple` and the mobile picker are **(unverified)**.

Refs: BU `react/src/select/root/SelectRoot.test.tsx`; Z `packages/machines/select/src/select.connect.ts`.

## 8. Tabs
- [ ] Roving tabindex; arrow keys follow orientation (`aria-orientation` only when vertical); RTL swap; Home/End; optional looping.
- [ ] Activation is manual by default in BU (`activateOnFocus=false`) and automatic in Z. A secondary-button press never activates a tab.
- [ ] Disabled tabs are focusable but not activatable.
  - If the selected tab becomes disabled, selection falls back to the first enabled tab.
  - If every tab is disabled, none is selected.
- [ ] Panels have `role=tabpanel`, `aria-labelledby`, `tabindex=0`, and `hidden` when inactive (optionally kept mounted).
- [ ] The indicator is positioned before hydration.

Refs: BU `react/src/tabs/root/TabsRoot.test.tsx`, `react/src/tabs/list/TabsList.test.tsx`; Z `e2e/tabs.e2e.ts`.

## 9. Accordion and Collapsible
- [ ] Triggers have `aria-expanded` and `aria-controls`. Panels are labelled by their trigger. Manually set ids are respected.
- [ ] Arrow keys and Home/End move between triggers in both libraries. A disabled non-native trigger leaves the tab order.
- [ ] `hidden="until-found"` with `beforematch` opens the panel on find-in-page. This requires the panel to stay mounted.
- [ ] Height animation:
  - uses a measured CSS variable;
  - does not run when the panel starts open;
  - survives interrupted open and close;
  - the panel unmounts only after the exit finishes.
- [ ] Native `<details name>` gives exclusivity and find-in-page, but has these gaps:
  - no arrow-key navigation;
  - it cannot forbid collapsing the last open item;
  - height animation needs `interpolate-size` (Chromium only) or JS;
  - whether a heading inside `<summary>` is exposed to screen readers is **(unverified)**.

Refs: BU `react/src/accordion/root/AccordionRoot.test.tsx`, `react/src/collapsible/panel/CollapsiblePanel.test.tsx`; Z `e2e/accordion.e2e.ts`.

## 10. Checkbox
- [ ] Space toggles; Enter does not.
- [ ] Wrapping labels and `for` labels toggle the checkbox.
- [ ] Read-only: `aria-readonly`, and a label click does nothing. The native `readonly` attribute does not apply to checkboxes.
- [ ] Indeterminate is exposed as `aria-checked="mixed"`. Native `indeterminate` is a property only, so it cannot be server-rendered, and it survives form reset **(verify)**.
- [ ] An unchecked box submits nothing. A parent "select all" checkbox and disabled or fieldset-disabled boxes are excluded from submission.
- [ ] Group `required` validation applies to the group and focuses the first child.

Refs: BU `react/src/checkbox/root/CheckboxRoot.test.tsx`, `react/src/checkbox-group/`; Z `e2e/checkbox.e2e.ts`.

## 11. Radio Group
- [ ] The group has `role=radiogroup` and is labelled by its legend.
- [ ] Arrow keys move focus and select; Enter does not select.
- [ ] There is one tab stop: the checked radio, or the first enabled one.
- [ ] Disabled radios are skipped, and arrow direction follows RTL.
- [ ] Selecting with arrow keys does not send clicks to ancestors (BU).
- [ ] Pressing an already focused radio with the mouse does not blur it to `<body>` (Z `preventDefault`).
- [ ] A disabled selected radio is excluded from submission; the value is null when nothing is selected; `required` works.
- [ ] Native radios cover roving focus, arrows, forms and reset. Custom elements need form-associated `ElementInternals` (`formResetCallback`, `formDisabledCallback`).

Refs: BU `react/src/radio-group/RadioGroup.test.tsx`; Z `packages/machines/radio-group/src/radio-group.connect.ts`.

## 12. Switch
- [ ] `role=switch` with `aria-checked`; Space toggles; `aria-readonly` and `aria-required` are set.
- [ ] An optional "unchecked" value is submitted when off, and is not submitted when disabled. Native validation runs on submit.
- [ ] `<input switch>` exists only in Safari. Elsewhere use `<input type=checkbox role=switch>`.

Refs: BU `react/src/switch/root/SwitchRoot.test.tsx`; Z `e2e/switch.e2e.ts`.

## 13. Toggle and Toggle Group
- [ ] Toggle: `aria-pressed`, a label that does not change with state, and a cancelable change.
- [ ] Group:
  - `role=group` with roving tabindex;
  - arrow keys and Home/End follow orientation;
  - single or multiple selection;
  - deselecting is allowed (Z `deselectable`);
  - disabled items are handled.

Refs: BU `react/src/toggle-group/ToggleGroup.test.tsx`; Z `e2e/toggle-group.e2e.ts`.

## 14. Slider
- [ ] BU renders a visually hidden `<input type=range>` per thumb. Vertical sliders use `writing-mode: vertical-lr` (`vertical-rl` in RTL).
- [ ] Keys:
  - arrows move by `step`;
  - PageUp/PageDown and Shift+arrow move by `largeStep`;
  - Home/End go to the ends;
  - values are clamped to min/max and rounded to the step.
- [ ] Each thumb has an `aria-valuetext` formatter and its own `aria-label`.
- [ ] Range sliders:
  - thumb collision behaviour is push, swap or none;
  - a minimum number of steps between thumbs is enforced;
  - moving focus between thumbs does not trigger validation.
- [ ] Pointer:
  - `touch-action:none`;
  - pressing the track moves the nearest thumb;
  - a disabled thumb cannot be dragged;
  - only one touch id is tracked.
- [ ] RTL inverts the axis. Thumb alignment can be edge or contain.
- [ ] The form submits clamped values, and an invalid submit focuses the input.

Refs: BU `react/src/slider/root/SliderRoot.test.tsx`, `react/src/slider/thumb/SliderThumb.tsx`; Z `packages/machines/slider/src/slider.style.ts`, `e2e/slider.e2e.ts`.

## 15. Field (label, description, error)
- [ ] The label's `for` points at the control.
- [ ] Description and error are in `aria-describedby` only while they are rendered. Ark detects them with a MutationObserver; BU never registers an empty error id.
- [ ] `aria-invalid` is set when invalid.
- [ ] Error timing:
  - `valueMissing` is not shown until the field is dirty or the form is submitted;
  - errors like `typeMismatch` show on blur;
  - after the first error, the field revalidates on change;
  - stale async results are discarded.
- [ ] On submit:
  - native error bubbles are off (`noValidate`) but the constraint API is still used;
  - focus goes to the first invalid field in DOM order;
  - server-side errors clear when the value changes.
- [ ] State attributes: dirty, touched, focused, filled, valid and invalid.
- [ ] Native: `:user-invalid` covers "invalid after interaction". Custom controls use `ElementInternals.setValidity`.

Refs: BU `react/src/field/root/FieldRoot.test.tsx`, `react/src/form/Form.test.tsx`; [Ark use-field.ts](https://github.com/chakra-ui/ark/blob/main/packages/react/src/components/field/use-field.ts).

## 16. Toast
- [ ] The viewport has `role=region` and `aria-live=polite`, with a label (Z includes the hotkey in it).
  - BU toasts have `role=dialog` or `alertdialog` with `aria-modal=false`; high-priority toasts also get a separate `role=alert` with `aria-atomic`.
  - Z toasts have `role=status` with `aria-atomic`.
- [ ] F6 (BU) or Alt+T (Z) focuses the viewport. Shift+Tab out restores the previous focus and resumes timers.
- [ ] Timers:
  - pause on hover, on focus, on window blur, and when the document is hidden (Z `pauseOnPageIdle`);
  - resume with the remaining time;
  - toasts over the `limit` stay hidden and paused.
- [ ] Swipe to dismiss:
  - respects direction and threshold;
  - locks to one axis;
  - does not start on buttons or inputs;
  - cancels when the gesture reverses;
  - calls `preventDefault` on touchmove only while a swipe is active.
- [ ] Toasts animate out before removal (Z `removeDelay` 200ms). When the focused toast closes, focus moves to the next one.
- [ ] See the modal-inertness and light-dismiss pitfalls in section 1.

Refs: BU `react/src/toast/useToastManager.test.tsx`, `react/src/toast/viewport/ToastViewport.tsx`; Z `packages/machines/toast/src/toast-group.machine.ts`, `e2e/toast.e2e.ts`.
