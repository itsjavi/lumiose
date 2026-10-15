// Option (b): the combobox, ported from Timeless's ui-combobox and reshaped for Lumiose:
//
// - `value` is the selected option's `data-value` and the input shows its label (Base UI's model;
//   Timeless's `value` is the input text).
// - It behaves as one form control: a `change` event on the host when the selection changes (the
//   inner input's own `change` stays inside), and the value is submitted under `name` through
//   ElementInternals. That pair is what a `bind:value` on custom elements would need.
// - Listeners are delegated and options are queried per event, so Lumiose may rerender them.
//
// The pattern is the APG combobox with a listbox popup, list autocomplete and manual selection.

const OPTION = "[role='option']";

// The module is also imported on the server, where there is no HTMLElement to extend.
const Base = (globalThis.HTMLElement ?? Object) as typeof HTMLElement;

export class ComboboxElement extends Base {
  static formAssociated = true;

  #internals: ElementInternals | undefined;
  #value = "";
  #ready = false;

  get input(): HTMLInputElement | null {
    return this.querySelector("input[role='combobox']");
  }

  get listbox(): HTMLElement | null {
    return this.querySelector("[role='listbox']");
  }

  /** The selected option's `data-value`, or "". Setting it selects that option without a `change`. */
  get value(): string {
    return this.#value;
  }

  set value(value: string | undefined) {
    this.#select(value ?? "", false);
  }

  connectedCallback(): void {
    this.#internals ??= this.attachInternals();
    if (!this.#ready) {
      this.#ready = true;
      // The server's selection: the `value` attribute, or an option rendered as selected.
      const selected = this.querySelector<HTMLElement>(`${OPTION}[aria-selected='true']`);
      this.#select(this.getAttribute("value") ?? selected?.dataset.value ?? this.#value, false);
    }
    for (const type of ["input", "keydown", "click", "focusout", "pointerdown", "change"]) {
      this.addEventListener(type, this);
    }
  }

  disconnectedCallback(): void {
    for (const type of ["input", "keydown", "click", "focusout", "pointerdown", "change"]) {
      this.removeEventListener(type, this);
    }
  }

  handleEvent(event: Event): void {
    switch (event.type) {
      case "input":
        this.#filter();
        break;
      case "keydown":
        this.#onKeyDown(event as KeyboardEvent);
        break;
      case "click": {
        const option = this.#optionAt(event.target);
        if (option) this.#choose(option);
        break;
      }
      case "pointerdown":
        // Keeps focus in the input while an option is clicked.
        if (this.listbox?.contains(event.target as Node)) event.preventDefault();
        break;
      case "focusout":
        if (!this.contains((event as FocusEvent).relatedTarget as Node | null)) {
          this.#close();
          this.#showLabel();
        }
        break;
      case "change":
        // The inner input's `change` reports typed text, not a selection: keep it inside.
        if (event.target !== this) event.stopPropagation();
        break;
    }
  }

  #options(): HTMLElement[] {
    return [...(this.listbox?.querySelectorAll<HTMLElement>(OPTION) ?? [])];
  }

  #visible(): HTMLElement[] {
    return this.#options().filter(
      (option) => !option.hidden && option.getAttribute("aria-disabled") !== "true",
    );
  }

  #optionAt(target: EventTarget | null): HTMLElement | null {
    const option = (target as Element | null)?.closest<HTMLElement>(OPTION) ?? null;
    return option &&
      this.listbox?.contains(option) &&
      option.getAttribute("aria-disabled") !== "true"
      ? option
      : null;
  }

  #highlighted(): HTMLElement | null {
    const id = this.input?.getAttribute("aria-activedescendant");
    return id ? this.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`) : null;
  }

  #highlight(option: HTMLElement | undefined): void {
    this.#highlighted()?.removeAttribute("data-highlighted");
    if (!option) {
      this.input?.removeAttribute("aria-activedescendant");
      return;
    }
    option.setAttribute("data-highlighted", "");
    this.input?.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }

  #open(): void {
    if (!this.listbox || this.listbox.matches(":popover-open")) return;
    this.listbox.showPopover();
    this.input?.setAttribute("aria-expanded", "true");
  }

  #close(): void {
    this.#highlight(undefined);
    if (this.listbox?.matches(":popover-open")) this.listbox.hidePopover();
    this.input?.setAttribute("aria-expanded", "false");
  }

  #filter(): void {
    const query = this.input?.value.trim().toLocaleLowerCase() ?? "";
    for (const option of this.#options()) {
      option.hidden = query !== "" && !label(option).toLocaleLowerCase().includes(query);
    }
    this.#highlight(undefined);
    if (this.#visible().length > 0) this.#open();
    else this.#close();
  }

  #onKeyDown(event: KeyboardEvent): void {
    if (event.target !== this.input) return;
    const open = this.listbox?.matches(":popover-open") ?? false;
    const options = this.#visible();
    const index = options.indexOf(this.#highlighted()!);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) this.#open();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const from = index === -1 ? (step === 1 ? -1 : 0) : index;
        this.#highlight(options.at((from + step) % options.length));
        break;
      }
      case "Enter": {
        const option = this.#highlighted();
        if (open && option) {
          event.preventDefault();
          this.#choose(option);
        }
        break;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          this.#close();
        } else {
          this.#showLabel();
        }
        break;
    }
  }

  #choose(option: HTMLElement): void {
    this.#select(option.dataset.value ?? "", true);
    this.#close();
  }

  #select(value: string, notify: boolean): void {
    const changed = value !== this.#value;
    this.#value = value;
    for (const option of this.#options()) {
      option.setAttribute("aria-selected", String(option.dataset.value === value));
      option.hidden = false;
    }
    this.#internals?.setFormValue(value || null);
    this.#showLabel();
    if (notify && changed) this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Puts the selected option's label back in the input. */
  #showLabel(): void {
    const selected = this.#options().find((option) => option.dataset.value === this.#value);
    if (this.input) this.input.value = selected ? label(selected) : "";
  }
}

function label(option: HTMLElement): string {
  return option.dataset.label ?? option.textContent?.trim() ?? "";
}

if (typeof customElements !== "undefined" && !customElements.get("lu-combobox")) {
  customElements.define("lu-combobox", ComboboxElement);
}
