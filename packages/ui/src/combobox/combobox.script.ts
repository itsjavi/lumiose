// Combobox's client script (decision-62, shipped through the client-script import of decision-63):
// it defines `<lu-combobox>`, the light-DOM, form-associated element that Combobox.Root renders. A
// combobox has no native equivalent (`<datalist>` cannot be styled or grouped, and customizable
// select cannot filter: doc-9 section 6), so the element owns the behaviour, after the APG
// combobox pattern with a listbox popup, list autocomplete and manual selection, and Base UI:
//
// - The parts are found through their ARIA wiring: the `input[role=combobox]`, the listbox its
//   `aria-controls` names, the popover around the listbox (the listbox itself, or `Combobox.Popup`),
//   the `[role=option]`s with `data-value`. Buttons act through invoker commands to the element
//   (`command="--toggle"`, `"--clear"`), and the chips and empty state by their ids (`<id>-chips`,
//   `<id>-empty`).
// - Value and label: `value` is the selected option's `data-value` (an array with `multiple`), the
//   input shows its label (`data-label` or its text). Typing filters the options (contains, or
//   `filter="startsWith"`; `filter="none"` leaves it to the page) and never commits: only choosing an
//   option does, and fires `change`, like a native control (the inner input's own `change` stays
//   inside). Closing without a choice puts the label back; emptying the input clears the choice.
// - Form: the element submits `value` under its `name` through ElementInternals (every value its own
//   entry with `multiple`), is `required` until it has a value, resets with its form and follows a
//   disabled fieldset.
// - Focus stays in the input: options are highlighted through `aria-activedescendant` and
//   `data-highlighted`, and presses in the popup keep focus where it is.
// - The popup is a manual popover dismissed by the shared layer model (../layer/layer.ts): an
//   outside press with the main button, a close request, Tab, Escape (which then stops there, so a
//   parent dialog stays open), or focus moving elsewhere. It is placed by anchor positioning, or by
//   ../placement/place.ts where that is missing.
//
// With `free` (Autocomplete, TASK-377), the input's text is the value, after the APG combobox with
// list autocomplete and Base UI's Autocomplete: the input itself has the name and submits the text,
// typing never has to match an option, and choosing one puts its value in the input (firing
// `input` and `change` on it). The popup opens as one types (on a click only with
// `open-on-input-click`) and closes when the text is emptied. With `inline`, the arrow keys show
// the highlighted option's text in the input until Escape puts the typed text back.
//
// Listeners are delegated and options are queried when an event needs them, so Lumiose may add,
// remove or rerender options at any time; a mutation observer gives new options the selection and
// the current search, and opens the popup when results arrive while the user types (async
// options). It must not import `lumiose`: server-rendered pages load it without the runtime.

import { openLayer } from "../layer/layer.ts";
import { anchoring, place } from "../placement/place.ts";

const OPTION = "[role=option]";

export interface ComboboxOpenChangeDetail {
  open: boolean;
}

/** How typing filters the options. */
export type ComboboxFilter = "contains" | "startsWith" | "none";

/** Invoker commands (Chrome 135, Firefox 144, Safari 26.2); elsewhere clicks stand in. */
const invokers =
  typeof HTMLButtonElement !== "undefined" && "command" in HTMLButtonElement.prototype;

/** The events the element listens to on itself. */
const EVENTS = [
  "input",
  "keydown",
  "click",
  "pointerdown",
  "pointermove",
  "focusout",
  "change",
  "command",
  "invalid",
];

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();

const disabled = (option: Element) => option.getAttribute("aria-disabled") === "true";

/** The text an option shows in the input and matches when typing. */
export const optionLabel = (option: HTMLElement) =>
  (option.dataset.label ?? option.textContent ?? "").trim();

/** The browser's own "select an item" message, in the page's language. */
let missing: string | undefined;

export class ComboboxElement extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = ["name", "required", "multiple", "disabled"];

  #internals = this.attachInternals();
  #values: string[] = [];
  /** The labels of the selected values: options may go away (async options) while selected. */
  #labels = new Map<string, string>();
  /** The selection the form resets to. */
  #defaults: string[] | undefined;
  /** Stops dismissing the popup (../layer/layer.ts). */
  #release: (() => void) | undefined;
  /** Whether a disabled fieldset around the element disables it. */
  #fieldsetDisabled = false;
  #observer: MutationObserver | undefined;
  /** With `free`: the text as typed, which inline completion and Escape go back to. */
  #typed = "";
  /** With `free`: an `input` event the element fires itself, which is no typing. */
  #echo = false;

  /** Whether the input's text is the value (Autocomplete). */
  get #free(): boolean {
    return this.hasAttribute("free");
  }

  /** The text field, `input[role=combobox]`. */
  get input(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>("input[role=combobox]");
  }

  /** The listbox of options, named by the input's `aria-controls`. */
  get listbox(): HTMLElement | null {
    const id = this.input?.getAttribute("aria-controls");
    return id ? this.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
  }

  /** The popover that shows the listbox: the listbox itself, or a popup around it. */
  get popup(): HTMLElement | null {
    const popup = this.listbox?.closest<HTMLElement>("[popover]");
    return popup && this.contains(popup) ? popup : null;
  }

  /** Whether several options can be selected; reflects the `multiple` attribute. */
  get multiple(): boolean {
    return this.hasAttribute("multiple");
  }

  set multiple(on: boolean) {
    this.toggleAttribute("multiple", on);
  }

  /** Whether the form needs a value; reflects the `required` attribute. */
  get required(): boolean {
    return this.hasAttribute("required");
  }

  set required(on: boolean) {
    this.toggleAttribute("required", on);
  }

  /** Whether the combobox is disabled; reflects the `disabled` attribute. */
  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }

  set disabled(on: boolean) {
    this.toggleAttribute("disabled", on);
  }

  /**
   * The selected option's value, `""` when none is; with `multiple`, the selected values. Setting
   * it selects those options without a `change` event.
   */
  get value(): string | string[] {
    return this.multiple ? [...this.#values] : (this.#values[0] ?? "");
  }

  set value(next: string | readonly string[] | null | undefined) {
    const values = next == null ? [] : typeof next === "string" ? (next ? [next] : []) : [...next];
    this.#set(this.multiple ? values : values.slice(0, 1), false);
  }

  /** Whether the popup is open. Setting it opens or closes the popup. */
  get open(): boolean {
    return this.popup?.matches(":popover-open") ?? false;
  }

  set open(value: boolean | undefined) {
    if (typeof value !== "boolean" || value === this.open) return;
    if (value) this.#show(true);
    else this.#close();
  }

  /** The name the value is submitted under; reflects the `name` attribute. */
  get name(): string {
    return this.getAttribute("name") ?? "";
  }

  set name(name: string) {
    this.setAttribute("name", name);
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  get validity(): ValidityState {
    return this.#internals.validity;
  }

  get validationMessage(): string {
    return this.#internals.validationMessage;
  }

  get willValidate(): boolean {
    return this.#internals.willValidate;
  }

  checkValidity(): boolean {
    return this.#internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.#internals.reportValidity();
  }

  connectedCallback(): void {
    for (const type of EVENTS) this.addEventListener(type, this);
    // `toggle` does not bubble: a capturing listener on the element still sees it.
    this.addEventListener("toggle", this, true);
    this.#observer ??= new MutationObserver((records) => this.#onMutation(records));
    this.#observer.observe(this, { childList: true, subtree: true });
    if (this.#defaults) return;
    // The server's selection, once the element's content is parsed: the options rendered selected.
    const settle = () => {
      if (this.#defaults) return;
      if (this.#free) this.#typed = this.input?.value ?? "";
      const selected = this.#options().filter((o) => o.getAttribute("aria-selected") === "true");
      for (const option of selected)
        this.#labels.set(option.dataset.value ?? "", optionLabel(option));
      const values = selected.map((option) => option.dataset.value ?? "");
      this.#defaults = this.multiple ? values : values.slice(0, 1);
      this.#set(this.#defaults, false);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", settle, { once: true });
    } else queueMicrotask(settle);
  }

  disconnectedCallback(): void {
    for (const type of EVENTS) this.removeEventListener(type, this);
    this.removeEventListener("toggle", this, true);
    this.#observer?.disconnect();
    this.#follow(false);
    this.#release?.();
    this.#release = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (name === "disabled" && this.disabled) this.#close();
    if (this.#defaults) this.#sync();
  }

  formResetCallback(): void {
    if (this.#free) {
      // The input resets itself, after the element.
      queueMicrotask(() => this.#showClear());
      return;
    }
    if (!this.#defaults) return;
    this.#set(this.#defaults, false);
    // The input resets after the element, to its own default: put the label back after it.
    queueMicrotask(() => this.#showLabel());
  }

  formDisabledCallback(off: boolean): void {
    this.#fieldsetDisabled = off;
    if (off) this.#close();
  }

  formStateRestoreCallback(state: string | FormData | null): void {
    if (this.#free) return;
    const values =
      state instanceof FormData
        ? state.getAll(this.name).map(String)
        : typeof state === "string" && state
          ? [state]
          : [];
    this.#set(values, false);
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case "input":
        if (event.target === this.input) this.#onInput();
        return;
      case "keydown":
        return this.#onKeyDown(event as KeyboardEvent);
      case "click":
        return this.#onClick(event as MouseEvent);
      case "pointerdown":
        return this.#onPress(event as PointerEvent);
      case "pointermove":
        return this.#onPointerMove(event as PointerEvent);
      case "focusout": {
        // With `free`, leaving the input accepts an inline completion.
        const input = this.input;
        if (this.#free && input && event.target === input && input.value !== this.#typed) {
          this.#complete(input.value, false);
        }
        // Focus moving to something else on the page (Tab, a click on a field) closes the popup.
        // Focus going nowhere (a click on the page, another window) leaves it to the outside-press
        // rules: a right-click outside keeps it open.
        const to = (event as FocusEvent).relatedTarget as Node | null;
        if (to && !this.contains(to)) this.#close();
        return;
      }
      case "change":
        // The inner input's `change` reports typed text, not a choice: it stays inside (with
        // `free`, the text is the value: it goes on).
        if (event.target !== this && !this.#free) event.stopPropagation();
        return;
      case "command": {
        const { command } = event as Event & { command: string };
        return this.#onCommand(command);
      }
      case "invalid":
        this.input?.setAttribute("aria-invalid", "true");
        return;
      case "toggle":
        return this.#onToggle(event as ToggleEvent);
      case "scroll":
      case "resize":
        return this.#place();
    }
  }

  // Parts -------------------------------------------------------------------------------------

  #options(): HTMLElement[] {
    return [...(this.listbox?.querySelectorAll<HTMLElement>(OPTION) ?? [])];
  }

  /** The options the arrow keys reach: shown and enabled. */
  #reachable(): HTMLElement[] {
    return this.#options().filter((option) => !option.hidden && !disabled(option));
  }

  #part(suffix: string): HTMLElement | null {
    return this.id ? document.getElementById(`${this.id}-${suffix}`) : null;
  }

  #highlighted(): HTMLElement | null {
    const id = this.input?.getAttribute("aria-activedescendant");
    return id ? this.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
  }

  #disabled(): boolean {
    return this.disabled || this.#fieldsetDisabled || !!this.input?.disabled;
  }

  // State -------------------------------------------------------------------------------------

  /** Selects `values`, reporting a change with `change` when `report` and they differ. */
  #set(values: string[], report: boolean): void {
    const before = this.#values;
    this.#values = [...new Set(values)];
    for (const option of this.#options()) {
      if (this.#values.includes(option.dataset.value ?? "")) {
        this.#labels.set(option.dataset.value ?? "", optionLabel(option));
      }
    }
    for (const key of this.#labels.keys())
      if (!this.#values.includes(key)) this.#labels.delete(key);
    this.#sync();
    if (!this.open) this.#showLabel();
    const changed =
      before.length !== this.#values.length || before.some((v, i) => v !== this.#values[i]);
    if (report && changed) {
      this.input?.removeAttribute("aria-invalid");
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /** Writes the selection to the options, the chips, the clear buttons and the form. */
  #sync(): void {
    if (this.#free) {
      // The input is the form control: the element submits nothing and is always valid.
      this.#internals.setFormValue(null);
      this.#internals.setValidity({});
      this.#showClear();
      return;
    }
    for (const option of this.#options()) {
      option.setAttribute(
        "aria-selected",
        String(this.#values.includes(option.dataset.value ?? "")),
      );
    }
    this.#renderChips();
    this.#showClear();
    const name = this.name;
    if (this.multiple && name) {
      const data = new FormData();
      for (const value of this.#values) data.append(name, value);
      this.#internals.setFormValue(data);
    } else this.#internals.setFormValue(this.#values[0] ?? null);
    if (this.hasAttribute("required") && this.#values.length === 0) {
      missing ??= Object.assign(document.createElement("select"), {
        required: true,
      }).validationMessage;
      this.#internals.setValidity({ valueMissing: true }, missing, this.input ?? undefined);
    } else this.#internals.setValidity({});
  }

  /** The input shows the selected option's label (single), or nothing (multiple). */
  #showLabel(): void {
    const input = this.input;
    if (!input || this.#free) {
      this.#showClear();
      return;
    }
    const text = this.multiple ? "" : (this.#labels.get(this.#values[0] ?? "") ?? "");
    if (input.value !== text) input.value = text;
    this.#showClear();
  }

  /** Clear buttons show while there is something to clear. */
  #showClear(): void {
    const empty = this.#values.length === 0 && !this.input?.value;
    for (const button of this.querySelectorAll<HTMLElement>("[command='--clear']")) {
      button.hidden = empty;
    }
  }

  /** One chip per selected value, in the chips list (`multiple`). */
  #renderChips(): void {
    const list = this.#part("chips");
    if (!list) return;
    const rendered = [...list.children].map((chip) => (chip as HTMLElement).dataset.value);
    if (
      rendered.length === this.#values.length &&
      rendered.every((v, i) => v === this.#values[i])
    ) {
      return;
    }
    const remove = list.dataset.removeLabel ?? "Remove";
    list.replaceChildren(
      ...this.#values.map((value) => {
        const label = this.#labels.get(value) ?? value;
        const chip = document.createElement("span");
        chip.setAttribute("role", "listitem");
        chip.dataset.value = value;
        const button = document.createElement("button");
        Object.assign(button, { type: "button", tabIndex: -1, textContent: "×", value });
        button.setAttribute("aria-label", `${remove} ${label}`);
        chip.append(label, button);
        return chip;
      }),
    );
  }

  // Filtering ---------------------------------------------------------------------------------

  /** Shows the options that match `query` (all of them for `""`) and the empty state if none do. */
  #filter(query: string): void {
    const mode = (this.getAttribute("filter") ?? "contains") as ComboboxFilter;
    const folded = fold(query.trim());
    for (const option of this.#options()) {
      if (mode === "none" || folded === "") option.hidden = false;
      else {
        const label = fold(optionLabel(option));
        option.hidden = !(mode === "startsWith"
          ? label.startsWith(folded)
          : label.includes(folded));
      }
    }
    // A group with nothing left to show goes too.
    for (const group of this.listbox?.querySelectorAll<HTMLElement>("[role=group]") ?? []) {
      group.hidden = ![...group.querySelectorAll<HTMLElement>(OPTION)].some((o) => !o.hidden);
    }
    const empty = this.#part("empty");
    if (empty) empty.hidden = this.#options().some((option) => !option.hidden);
  }

  /** Whether the popup has anything to show: an option, or the empty state. */
  #showable(): boolean {
    return this.#options().some((option) => !option.hidden) || this.#part("empty") !== null;
  }

  // Opening and closing -----------------------------------------------------------------------

  /** Opens the popup with every option, highlighting the selected one when `highlight`. */
  #show(highlight: boolean, edge: "first" | "last" = "first"): void {
    if (this.#disabled()) return;
    const input = this.input;
    // The label of the selection is not a search: show every option. A free text is one.
    if (this.#free) this.#filter(this.#typed);
    else if (
      !input ||
      input.value === "" ||
      input.value === this.#labels.get(this.#values[0] ?? "")
    ) {
      this.#filter("");
    }
    this.#open();
    if (!this.open || !highlight) return;
    const reachable = this.#reachable();
    const selected = reachable.find((o) => this.#values.includes(o.dataset.value ?? ""));
    this.#highlight(selected ?? (edge === "first" ? reachable[0] : reachable.at(-1)));
  }

  #open(): void {
    const popup = this.popup;
    const input = this.input;
    if (!popup || !input || this.open || !this.#showable()) return;
    // `source` makes the input the popover's invoker: focus order and nesting follow it.
    (popup.showPopover as (options?: { source?: HTMLElement }) => void)({ source: input });
    this.#place();
    this.#follow(true);
    this.#release?.();
    this.#release = openLayer({
      popup,
      contains: (node) => this.contains(node),
      dismiss: () => this.#close(),
    });
  }

  /** Closes the popup; `restore` puts the selection's label back in the input. */
  #close(restore = true): void {
    this.#highlight(undefined);
    this.#release?.();
    this.#release = undefined;
    if (this.open) this.popup!.hidePopover();
    if (restore) this.#showLabel();
  }

  #onToggle(event: ToggleEvent): void {
    if (event.target !== this.popup) return;
    const open = event.newState === "open";
    this.input?.setAttribute("aria-expanded", String(open));
    if (!open) {
      this.#follow(false);
      this.#release?.();
      this.#release = undefined;
      this.#highlight(undefined);
    }
    this.dispatchEvent(
      new CustomEvent<ComboboxOpenChangeDetail>("openchange", { detail: { open } }),
    );
  }

  /** While open without anchor positioning, the popup follows the input on scroll and resize. */
  #follow(on: boolean): void {
    if (anchoring) return;
    const method = on ? "addEventListener" : "removeEventListener";
    for (const type of ["scroll", "resize"]) window[method](type, this, true);
  }

  #place(): void {
    const input = this.input;
    if (!anchoring && input && this.open) place(this.popup!, input);
  }

  // Highlight and choice ----------------------------------------------------------------------

  #highlight(option: HTMLElement | undefined): void {
    const current = this.#highlighted();
    if (current === option) return;
    current?.removeAttribute("data-highlighted");
    const input = this.input;
    if (!option) {
      input?.removeAttribute("aria-activedescendant");
      return;
    }
    option.setAttribute("data-highlighted", "");
    input?.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView?.({ block: "nearest" });
  }

  /**
   * With `inline`: the input shows the highlighted option's text, the part past what was typed
   * selected; back on the input (no option), the typed text.
   */
  #inline(option: HTMLElement | undefined): void {
    const input = this.input;
    if (!input) return;
    const text = option ? (option.dataset.value ?? optionLabel(option)) : this.#typed;
    input.value = text;
    const typed = this.#typed;
    if (option && fold(text).startsWith(fold(typed)))
      input.setSelectionRange(typed.length, text.length);
  }

  /** Chooses `option`: selects it (toggles it with `multiple`). */
  #choose(option: HTMLElement): void {
    if (disabled(option)) return;
    if (this.#free) {
      this.#close(false);
      this.#complete(option.dataset.value ?? optionLabel(option), true);
      return;
    }
    const value = option.dataset.value ?? "";
    this.#labels.set(value, optionLabel(option));
    if (!this.multiple) {
      this.#set([value], true);
      this.#close();
      return;
    }
    const values = this.#values.includes(value)
      ? this.#values.filter((v) => v !== value)
      : [...this.#values, value];
    // The search is done: clear it and show every option again, keeping the highlight.
    if (this.input) this.input.value = "";
    this.#filter("");
    this.#set(values, true);
    this.#highlight(option);
  }

  #remove(value: string): void {
    this.#set(
      this.#values.filter((v) => v !== value),
      true,
    );
  }

  // Events ------------------------------------------------------------------------------------

  /** With `free`: puts `text` in the input, as typing would; `commit` also fires `change`. */
  #complete(text: string, commit: boolean): void {
    const input = this.input;
    if (!input) return;
    input.value = text;
    this.#typed = text;
    this.#echo = true;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    this.#echo = false;
    if (commit) input.dispatchEvent(new Event("change", { bubbles: true }));
    this.#showClear();
  }

  #onInput(): void {
    const input = this.input!;
    if (this.#free) {
      if (this.#echo) return;
      this.#typed = input.value;
      this.#filter(input.value);
      this.#highlight(undefined);
      this.#showClear();
      // An empty input closes the popup (the arrow keys open it with every option).
      if (input.value !== "" && this.#showable()) this.#open();
      else this.#close(false);
      return;
    }
    // Clearing the text clears a single selection.
    if (!this.multiple && input.value === "" && this.#values.length > 0) this.#set([], true);
    this.#filter(input.value);
    this.#highlight(undefined);
    this.#showClear();
    if (this.#showable()) this.#open();
    else this.#close(false);
  }

  /** Options added or removed (async options): they take the selection and the current search. */
  #onMutation(records: MutationRecord[]): void {
    const listbox = this.listbox;
    // Before the server's selection is read, the parser may still be adding the options.
    if (!this.#defaults || !listbox || !records.some((r) => listbox.contains(r.target))) return;
    this.#sync();
    const input = this.input;
    const label = this.#labels.get(this.#values[0] ?? "");
    const search = this.#free ? this.#typed : input && input.value !== label ? input.value : "";
    this.#filter(search);
    const highlighted = this.#highlighted();
    if (highlighted && (!highlighted.isConnected || highlighted.hidden)) this.#highlight(undefined);
    if (this.open && !this.#showable()) this.#close(false);
    else if (!this.open && search && document.activeElement === input && this.#showable()) {
      this.#open();
    }
  }

  #onKeyDown(event: KeyboardEvent): void {
    const input = this.input;
    if (!input || event.target !== input || event.isComposing || event.defaultPrevented) return;
    const open = this.open;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const down = event.key === "ArrowDown";
        if (event.altKey) {
          // Alt+Arrow Down opens without moving the highlight, Alt+Arrow Up closes.
          if (down) this.#show(false);
          else this.#close();
          return;
        }
        if (!open) {
          this.#show(true, down ? "first" : "last");
          return;
        }
        // From the last option the highlight goes back to the input, then around, as in Base UI.
        const reachable = this.#reachable();
        const index = reachable.indexOf(this.#highlighted()!);
        const next = index === -1 ? (down ? 0 : reachable.length - 1) : index + (down ? 1 : -1);
        this.#highlight(reachable[next]);
        if (this.#free && this.hasAttribute("inline")) this.#inline(reachable[next]);
        return;
      }
      case "Enter": {
        const option = this.#highlighted();
        if (open && option) {
          event.preventDefault();
          this.#choose(option);
        }
        return;
      }
      case "Escape":
        // Closed: the key goes on, so a parent dialog closes.
        if (open) {
          event.preventDefault();
          // An inline completion goes back to the typed text.
          if (this.#free) input.value = this.#typed;
          this.#close();
        }
        return;
      case "Tab":
        this.#close();
        return;
      case "Backspace":
        // With `multiple`, Backspace in an empty input removes the last value.
        if (this.multiple && input.value === "" && this.#values.length > 0) {
          event.preventDefault();
          this.#remove(this.#values.at(-1)!);
        }
        return;
    }
  }

  #onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const option = target.closest<HTMLElement>(OPTION);
    if (option && this.listbox?.contains(option)) {
      this.#choose(option);
      return;
    }
    const chip = target.closest<HTMLButtonElement>("button");
    if (chip && this.#part("chips")?.contains(chip)) {
      this.#remove(chip.value);
      this.input?.focus();
      return;
    }
    // A click on the input opens the popup, as in Base UI (an Autocomplete's with
    // `open-on-input-click`).
    if (target === this.input) {
      const opens = !this.#free || this.hasAttribute("open-on-input-click");
      if (!this.open && event.button === 0 && opens) this.#show(!this.#free);
      return;
    }
    // Invoker commands where the browser lacks them.
    const invoker = target.closest<HTMLButtonElement>("button[command^='--']");
    if (!invokers && invoker && this.contains(invoker)) {
      this.#onCommand(invoker.getAttribute("command")!);
    }
  }

  #onCommand(command: string): void {
    if (this.#disabled()) return;
    if (command === "--toggle") {
      if (this.open) this.#close();
      else this.#show(true);
      this.input?.focus();
    } else if (command === "--clear") {
      if (this.#free) this.#complete("", true);
      else if (this.input) this.input.value = "";
      this.#filter("");
      this.#set([], true);
      this.#close(false);
      this.input?.focus();
    }
  }

  #onPress(event: PointerEvent): void {
    const target = event.target as Element;
    // Presses in the popup and on the buttons keep focus in the input.
    if (target !== this.input && (this.popup?.contains(target) || target.closest("button"))) {
      event.preventDefault();
    }
  }

  #onPointerMove(event: PointerEvent): void {
    // Keyboard scrolling under a resting pointer moves nothing (WebKit fires zero-delta moves).
    if (event.pointerType === "touch" || (event.movementX === 0 && event.movementY === 0)) return;
    const option = (event.target as Element).closest?.<HTMLElement>(OPTION);
    if (option && this.listbox?.contains(option) && !disabled(option) && !option.hidden) {
      this.#highlight(option);
    }
  }
}

if (!customElements.get("lu-combobox")) customElements.define("lu-combobox", ComboboxElement);
