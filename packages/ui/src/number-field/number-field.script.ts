// Number Field's client script (decision-62, decision-63): it defines `<lu-number-field>`, the
// light-DOM element NumberField.Root renders. Its input is native, so typing, `required`, the
// form's value, reset and a disabled fieldset are the platform's:
//
// - Without `format`, a native `<input type="number">`: the browser steps it with the arrow keys,
//   validates `min`, `max` and `step`, and submits the number, in server HTML and without
//   JavaScript.
// - With `format` (`Intl.NumberFormat` options, JSON), an `<input type="text" role="spinbutton">`
//   showing the formatted value, and an `<input type="hidden">` with the number: the element moves
//   the `name` from the text input to the hidden one when it connects (without JavaScript, the
//   text input submits its text).
//
// The element adds, after Base UI's NumberField and the APG spinbutton:
//
// - The keys: Arrow Up and Arrow Down step by `step`, Shift with them and Page Up and Page Down by
//   `large-step` (default 10), Home and End go to `min` and `max`.
// - The `[data-action=increment]` and `[data-action=decrement]` buttons: a press steps once, and
//   holding it steps again and again; a click from the keyboard or assistive technology steps once.
//   They are disabled at the ends of the range.
// - A `[data-scrub]` area: dragging across it steps the value (`data-direction`, horizontal or
//   vertical, and `data-pixel-sensitivity`, pixels per step); right to left, leftward goes up.
// - The wheel steps the value only while the input has focus and the pointer is over it, with
//   `allow-wheel-scrub`, and never otherwise (Chromium's native stepping of a focused number input
//   is cancelled).
// - On commit (`change`: leaving the input, Enter), the typed value is read in the locale, kept in
//   `min` and `max` (unless `allow-out-of-range`) and shown formatted. Every change the element
//   makes fires `input` on the input, and `change` when it is done, like typing does.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.
import { formatNumber, formatter, parseNumber } from "./format.ts";

/** How long a held button waits before it repeats, and how often it repeats then. */
const HOLD = 400;
const REPEAT = 60;

const finite = (value: string | null): number | undefined => {
  const parsed = value === null || value === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** The digits after the decimal point of `value`, for sums without floating-point noise. */
const decimals = (value: number) => (String(value).split(".")[1] ?? "").length;

export class NumberFieldElement extends HTMLElement {
  /** The number before the current edit, which an unreadable edit goes back to. */
  #committed: number | null = null;
  /** The held button or scrub drag in progress. */
  #holding: { stop: () => void } | undefined;
  /** A pointer press on a button just stepped: its click must not step again. */
  #pressed = false;
  #numbers: Intl.NumberFormat | undefined;

  /** The input people type in: the native number input, or the formatted text input. */
  get input(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>("input:not([type=hidden])");
  }

  /** With `format`, the hidden input that holds and submits the number. */
  get hiddenInput(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>("input[type=hidden]");
  }

  /** Whether the input shows a formatted value (`format`), not a native number. */
  get formatted(): boolean {
    return this.input?.type !== "number";
  }

  // The range from the attributes. Not properties: Lumiose would set them instead of the attributes.
  get #min(): number | undefined {
    return finite(this.getAttribute("min"));
  }

  get #max(): number | undefined {
    return finite(this.getAttribute("max"));
  }

  get #step(): number {
    return finite(this.getAttribute("step")) ?? 1;
  }

  get #largeStep(): number {
    return finite(this.getAttribute("large-step")) ?? 10;
  }

  /** The number, `null` when the field is empty. Setting it shows it, without events. */
  get value(): number | null {
    const input = this.input;
    if (!input) return null;
    if (!this.formatted) return input.value === "" ? null : input.valueAsNumber;
    const parsed = parseNumber(input.value, this.#format());
    return parsed === null || Number.isNaN(parsed) ? null : parsed;
  }

  set value(next: number | null | undefined) {
    this.#write(next ?? null);
    this.#committed = next ?? null;
  }

  connectedCallback(): void {
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("input", this.#onInput);
    this.addEventListener("change", this.#onChange, true);
    this.addEventListener("pointerdown", this.#onPress);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("wheel", this.#onWheel, { passive: false });
    this.addEventListener("focusin", this.#onFocus);
    document.addEventListener("reset", this.#onReset, true);
    const settle = () => {
      const hidden = this.hiddenInput;
      const input = this.input;
      // The number submits from the hidden input, once the script can keep it current.
      if (hidden && input?.name && this.formatted) {
        hidden.name = input.name;
        input.removeAttribute("name");
      }
      this.#committed = this.value;
      this.#sync();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", settle, { once: true });
    } else queueMicrotask(settle);
  }

  disconnectedCallback(): void {
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("change", this.#onChange, true);
    this.removeEventListener("pointerdown", this.#onPress);
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("wheel", this.#onWheel);
    this.removeEventListener("focusin", this.#onFocus);
    document.removeEventListener("reset", this.#onReset, true);
    this.#holding?.stop();
  }

  #format(): Intl.NumberFormat {
    if (!this.#numbers) {
      let options: Intl.NumberFormatOptions | undefined;
      try {
        options = JSON.parse(this.getAttribute("format") ?? "null") ?? undefined;
      } catch {
        options = undefined;
      }
      this.#numbers = formatter(options, this.getAttribute("locale"));
    }
    return this.#numbers;
  }

  #usable(): boolean {
    const input = this.input;
    return !!input && !input.disabled && !input.readOnly;
  }

  /** `value` within `min` and `max`. */
  #clamp(value: number): number {
    const [min, max] = [this.#min, this.#max];
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
  }

  /** Shows `value` in the input (formatted or native) and the hidden input. */
  #write(value: number | null): void {
    const input = this.input;
    if (!input) return;
    const text = this.formatted
      ? formatNumber(value, this.#format())
      : value === null
        ? ""
        : String(value);
    if (input.value !== text) input.value = text;
    this.#sync();
  }

  /** The hidden input, the spinbutton's ARIA values and the buttons, from the current value. */
  #sync(): void {
    const input = this.input;
    if (!input) return;
    const value = this.value;
    const hidden = this.hiddenInput;
    if (hidden) hidden.value = value === null ? "" : String(value);
    if (this.formatted) {
      const set = (name: string, number: number | null | undefined) => {
        if (number === null || number === undefined) input.removeAttribute(name);
        else input.setAttribute(name, String(number));
      };
      set("aria-valuenow", value);
      set("aria-valuemin", this.#min);
      set("aria-valuemax", this.#max);
      if (value === null) input.removeAttribute("aria-valuetext");
      else input.setAttribute("aria-valuetext", formatNumber(value, this.#format()));
    }
    const usable = this.#usable();
    for (const button of this.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
      const up = button.dataset.action === "increment";
      const limit = up ? this.#max : this.#min;
      const atLimit =
        value !== null && limit !== undefined && (up ? value >= limit : value <= limit);
      button.disabled = !usable || atLimit;
    }
  }

  /** Sets the value as the user would: fires `input`, and `change` when `commit`. */
  #set(value: number | null, commit: boolean): void {
    const input = this.input;
    if (!input) return;
    const before = input.value;
    this.#write(value);
    if (input.value !== before) input.dispatchEvent(new Event("input", { bubbles: true }));
    if (commit) {
      if (this.#committed !== value) input.dispatchEvent(new Event("change", { bubbles: true }));
      this.#committed = value;
    }
  }

  /** Steps the value by `amount` (up when positive), from `min` (or 0) when it is empty. */
  #stepBy(amount: number, commit: boolean): void {
    if (!this.#usable()) return;
    const current = this.value;
    const start = current ?? (amount > 0 ? (this.#min ?? 0) - amount : (this.#max ?? 0) - amount);
    const places = Math.max(decimals(start), decimals(amount));
    const next = this.#clamp(Number((start + amount).toFixed(places)));
    this.#set(next, commit);
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== this.input || event.isComposing || !this.#usable()) return;
    const [step, largeStep, min, max] = [this.#step, this.#largeStep, this.#min, this.#max];
    let handled = true;
    switch (event.key) {
      case "ArrowUp":
        this.#stepBy(event.shiftKey ? largeStep : step, true);
        break;
      case "ArrowDown":
        this.#stepBy(-(event.shiftKey ? largeStep : step), true);
        break;
      case "PageUp":
        this.#stepBy(largeStep, true);
        break;
      case "PageDown":
        this.#stepBy(-largeStep, true);
        break;
      case "Home":
        if (min === undefined) handled = false;
        else this.#set(min, true);
        break;
      case "End":
        if (max === undefined) handled = false;
        else this.#set(max, true);
        break;
      case "Enter":
        // Commits, then lets the form submit with the number.
        this.#commit();
        handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  #onInput = (event: Event) => {
    if (event.target !== this.input) return;
    // Typing: the hidden input and the ARIA values follow what the text reads as.
    this.#sync();
  };

  /** Reads the typed value, keeps it in range and shows it formatted. */
  #commit(): void {
    const input = this.input;
    if (!input) return;
    let value: number | null;
    if (this.formatted) {
      const parsed = parseNumber(input.value, this.#format());
      value = parsed !== null && Number.isNaN(parsed) ? this.#committed : parsed;
    } else value = input.value === "" ? null : input.valueAsNumber;
    if (value !== null && !this.hasAttribute("allow-out-of-range")) value = this.#clamp(value);
    // As shown: the formatted value is what the field holds.
    if (value !== null && this.formatted) {
      value = parseNumber(formatNumber(value, this.#format()), this.#format()) ?? value;
    }
    const before = input.value;
    this.#write(value);
    if (input.value !== before) input.dispatchEvent(new Event("input", { bubbles: true }));
    this.#committed = value;
  }

  // The input's own `change` (leaving it after typing): commit first, so it reports the number.
  #onChange = (event: Event) => {
    if (event.target === this.input && event.isTrusted) this.#commit();
  };

  #onFocus = (event: FocusEvent) => {
    if (event.target === this.input) this.#committed = this.value;
  };

  /** A form reset puts the input back without an `input` event: the rest follows it. */
  #onReset = (event: Event) => {
    if (this.input?.form !== event.target) return;
    setTimeout(() => {
      this.#committed = this.value;
      this.#sync();
    });
  };

  #onWheel = (event: WheelEvent) => {
    const input = this.input;
    if (event.target !== input || document.activeElement !== input || event.deltaY === 0) return;
    if (!this.hasAttribute("allow-wheel-scrub")) {
      // Chromium steps a focused number input on the wheel: here only `allow-wheel-scrub` does.
      if (!this.formatted) event.preventDefault();
      return;
    }
    if (!this.#usable()) return;
    event.preventDefault();
    this.#stepBy(event.deltaY < 0 ? this.#step : -this.#step, true);
  };

  /**
   * Repeats `action` while the pointer stays down: once now, then after a pause, faster. It stops
   * when the press ends, wherever it ends, or when `action` returns `false` (a button that got
   * disabled at the end of the range no longer gets pointer events).
   */
  #hold(
    target: HTMLElement,
    event: PointerEvent,
    action: () => boolean | void,
    done: () => void,
  ): void {
    this.#holding?.stop();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      clearTimeout(timer);
      for (const type of ["pointerup", "pointercancel"]) removeEventListener(type, end, true);
      removeEventListener("blur", stop);
      target.removeEventListener("lostpointercapture", stop);
      if (this.#holding?.stop === stop) this.#holding = undefined;
      done();
    };
    const end = (next: Event) => {
      if ((next as PointerEvent).pointerId === event.pointerId) stop();
    };
    const repeat = () => {
      if (action() === false) stop();
      else timer = setTimeout(repeat, REPEAT);
    };
    target.setPointerCapture?.(event.pointerId);
    for (const type of ["pointerup", "pointercancel"]) addEventListener(type, end, true);
    addEventListener("blur", stop);
    target.addEventListener("lostpointercapture", stop);
    this.#holding = { stop };
    if (action() === false) stop();
    else timer = setTimeout(repeat, HOLD);
  }

  #onPress = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || !this.#usable()) return;
    const target = event.target as Element;
    const button = target.closest?.<HTMLButtonElement>("button[data-action]");
    if (button && this.contains(button) && !button.disabled) {
      // Focus stays where it is: no virtual keyboard opens, and the input keeps its caret.
      event.preventDefault();
      this.#pressed = true;
      const amount = button.dataset.action === "increment" ? this.#step : -this.#step;
      this.#hold(
        button,
        event,
        () => {
          if (button.disabled) return false;
          this.#stepBy(amount, false);
        },
        () => {
          this.#settle();
          // After the click this press may fire (none when it ends off the button).
          setTimeout(() => (this.#pressed = false));
        },
      );
      return;
    }
    const area = target.closest?.<HTMLElement>("[data-scrub]");
    if (area && this.contains(area)) this.#scrub(area, event);
  };

  /** Ends a press or a drag: commits the value it reached. */
  #settle(): void {
    const input = this.input;
    if (!input) return;
    const value = this.value;
    if (this.#committed !== value) input.dispatchEvent(new Event("change", { bubbles: true }));
    this.#committed = value;
    this.removeAttribute("data-scrubbing");
  }

  #onClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest?.<HTMLButtonElement>("button[data-action]");
    if (!button || !this.contains(button)) return;
    // The click that ends a pointer press already stepped; one from a key or a screen reader steps.
    if (this.#pressed) {
      this.#pressed = false;
      return;
    }
    this.#stepBy(button.dataset.action === "increment" ? this.#step : -this.#step, true);
  };

  /** Dragging across a scrub area steps the value, one step per `data-pixel-sensitivity` px. */
  #scrub(area: HTMLElement, event: PointerEvent): void {
    event.preventDefault();
    const vertical = area.dataset.direction === "vertical";
    // Right to left, a horizontal drag goes up toward the left, as a slider does (TASK-385).
    const sign = !vertical && getComputedStyle(area).direction === "rtl" ? -1 : 1;
    const sensitivity = finite(area.dataset.pixelSensitivity ?? null) ?? 2;
    let travelled = 0;
    let last = vertical ? event.clientY : event.clientX;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      const position = vertical ? next.clientY : next.clientX;
      // Right and up go up.
      travelled += vertical ? last - position : (position - last) * sign;
      last = position;
      const steps = Math.trunc(travelled / sensitivity);
      if (steps === 0) return;
      travelled -= steps * sensitivity;
      this.setAttribute("data-scrubbing", "");
      this.#stepBy(steps * this.#step, false);
    };
    area.addEventListener("pointermove", move);
    this.#hold(
      area,
      event,
      () => {},
      () => {
        area.removeEventListener("pointermove", move);
        this.#settle();
      },
    );
  }
}

if (!customElements.get("lu-number-field")) {
  customElements.define("lu-number-field", NumberFieldElement);
}
