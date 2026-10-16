// OTP Field's client script (decision-62, decision-63): it defines `<lu-otp-field>`, the light-DOM
// element OTPField.Root renders around one native `<input>` and the visual slots that show its
// characters. The input is the field: SMS autofill (`autocomplete="one-time-code"`), paste,
// Backspace, the arrow keys, `maxlength`, `pattern`, `required` and the form's value are the
// platform's, and assistive technology meets one text field, not one per character. Without
// JavaScript the input shows as a plain text field and the slots stay hidden (otp-field.css).
//
// The element:
//
// - keeps the value to the allowed characters (`validation-type`: numeric, the default; alpha;
//   alphanumeric; none) and to `length`, dropping spaces, as typing, a paste or autofill puts them
//   in (a paste is cleaned before `maxlength` could cut it); rejected characters fire
//   `valueinvalid` (`detail.value`, what was entered);
// - shows the value in the `[data-slot]` elements (as dots with `mask`), with `data-filled`, and the
//   caret's slot with `data-active` while the input has focus; `data-complete` on the element;
// - types over the character at the caret when the field is full, and moves the caret to the slot a
//   press lands on;
// - fires `valuecomplete` (`detail.value`) when the last slot fills, and with `auto-submit` submits
//   the form;
// - with a `normalizeValue` function (a property: OTPField.Root sets it in an island, TASK-413),
//   normalizes what is entered (`toUpperCase`, say) before it keeps it to the allowed characters.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

export interface OTPFieldValueDetail {
  value: string;
}

/** The characters each validation type keeps. */
const ALLOWED: Record<string, RegExp> = {
  numeric: /\p{Nd}/u,
  alpha: /\p{L}/u,
  alphanumeric: /[\p{L}\p{Nd}]/u,
  none: /\S/u,
};

export class OTPFieldElement extends HTMLElement {
  /** The value when the last `valuecomplete` fired, so it fires once per completion. */
  #completed = "";

  /** Normalizes what is entered before the allowed characters are kept: an island sets it. */
  normalizeValue: ((value: string) => string) | undefined;

  /** The input that holds the value. */
  get input(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>("input");
  }

  /** The visual slots, in order. */
  get slots(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>("[data-slot]")].filter(
      (slot) => slot.closest("lu-otp-field") === this,
    );
  }

  /** The number of characters; the `length` attribute. Not a property Lumiose would set. */
  get #length(): number {
    const length = Number(this.getAttribute("length"));
    return Number.isInteger(length) && length > 0 ? length : this.slots.length;
  }

  /** The code. Setting it shows it, kept to the allowed characters, without events. */
  get value(): string {
    return this.input?.value ?? "";
  }

  set value(next: string | null | undefined) {
    const input = this.input;
    if (!input) return;
    input.value = this.#clean(next ?? "");
    this.#completed = input.value.length === this.#length ? input.value : "";
    this.#sync();
  }

  connectedCallback(): void {
    // Capturing: the value is cleaned before any other listener reads it.
    this.addEventListener("input", this.#onInput, true);
    this.addEventListener("beforeinput", this.#onBeforeInput);
    this.addEventListener("paste", this.#onPaste);
    this.addEventListener("pointerdown", this.#onPress);
    this.addEventListener("focusin", this.#onFocus);
    this.addEventListener("focusout", this.#onFocus);
    document.addEventListener("selectionchange", this.#onSelection);
    document.addEventListener("reset", this.#onReset, true);
    const settle = () => {
      this.#completed = this.value.length === this.#length ? this.value : "";
      this.#sync();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", settle, { once: true });
    } else queueMicrotask(settle);
  }

  disconnectedCallback(): void {
    this.removeEventListener("input", this.#onInput, true);
    this.removeEventListener("beforeinput", this.#onBeforeInput);
    this.removeEventListener("paste", this.#onPaste);
    this.removeEventListener("pointerdown", this.#onPress);
    this.removeEventListener("focusin", this.#onFocus);
    this.removeEventListener("focusout", this.#onFocus);
    document.removeEventListener("selectionchange", this.#onSelection);
    document.removeEventListener("reset", this.#onReset, true);
  }

  /** `text` kept to the allowed characters and the length. */
  #clean(text: string): string {
    const allowed = ALLOWED[this.getAttribute("validation-type") ?? "numeric"] ?? ALLOWED.numeric!;
    return [...this.#normalize(text)]
      .filter((char) => allowed.test(char))
      .slice(0, this.#length)
      .join("");
  }

  #normalize(text: string): string {
    return this.normalizeValue ? this.normalizeValue(text) : text;
  }

  /** Whether `text` holds characters the field does not allow (spaces aside). */
  #rejects(text: string): boolean {
    const allowed = ALLOWED[this.getAttribute("validation-type") ?? "numeric"] ?? ALLOWED.numeric!;
    return [...this.#normalize(text)].some((char) => /\S/u.test(char) && !allowed.test(char));
  }

  /** Writes the value to the slots, and the caret's slot while the input has focus. */
  #sync(): void {
    const input = this.input;
    if (!input) return;
    const value = input.value;
    const length = this.#length;
    const mask = this.hasAttribute("mask");
    const focused = document.activeElement === input;
    const caret = Math.min(input.selectionStart ?? value.length, length - 1);
    this.slots.forEach((slot, i) => {
      const char = value[i] ?? "";
      const text = char && mask ? "•" : char;
      if (slot.textContent !== text) slot.textContent = text;
      slot.toggleAttribute("data-filled", char !== "");
      slot.toggleAttribute("data-active", focused && i === caret);
    });
    this.toggleAttribute("data-complete", value.length === length);
    this.toggleAttribute("data-filled", value.length > 0);
    this.toggleAttribute("data-focused", focused);
  }

  #onInput = (event: Event) => {
    const input = this.input;
    if (!input || event.target !== input) return;
    const raw = input.value;
    const clean = this.#clean(raw);
    if (this.#rejects(raw)) {
      this.dispatchEvent(
        new CustomEvent<OTPFieldValueDetail>("valueinvalid", { detail: { value: raw } }),
      );
    }
    if (clean !== raw) {
      // The caret stays after the same characters it was after, those that remain.
      const caret = input.selectionStart ?? raw.length;
      const at = Math.min(this.#clean(raw.slice(0, caret)).length, clean.length);
      input.value = clean;
      input.setSelectionRange(at, at);
    }
    this.#sync();
    if (clean.length === this.#length && clean !== this.#completed) {
      this.#completed = clean;
      // After the other listeners have seen the value.
      queueMicrotask(() => {
        this.dispatchEvent(
          new CustomEvent<OTPFieldValueDetail>("valuecomplete", { detail: { value: clean } }),
        );
        if (this.hasAttribute("auto-submit")) input.form?.requestSubmit();
      });
    } else if (clean.length < this.#length) this.#completed = "";
  };

  /** A full field: typing replaces the character at the caret instead of being refused. */
  #onBeforeInput = (event: InputEvent) => {
    const input = this.input;
    if (!input || event.target !== input || event.inputType !== "insertText" || !event.data) return;
    const { selectionStart: start, selectionEnd: end, value } = input;
    if (value.length < this.#length || start === null || start !== end || start >= value.length) {
      return;
    }
    event.preventDefault();
    const char = this.#clean(event.data).slice(0, 1);
    if (!char) {
      this.dispatchEvent(
        new CustomEvent<OTPFieldValueDetail>("valueinvalid", { detail: { value: event.data } }),
      );
      return;
    }
    input.value = value.slice(0, start) + char + value.slice(start + 1);
    const next = Math.min(start + 1, value.length);
    input.setSelectionRange(next, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  /**
   * A paste: cleaned first, then put in place of the selection, so `maxlength` does not cut a
   * code pasted with spaces or dashes.
   */
  #onPaste = (event: ClipboardEvent) => {
    const input = this.input;
    const text = event.clipboardData?.getData("text") ?? "";
    if (!input || event.target !== input || input.readOnly || !text) return;
    event.preventDefault();
    if (this.#rejects(text)) {
      this.dispatchEvent(
        new CustomEvent<OTPFieldValueDetail>("valueinvalid", { detail: { value: text } }),
      );
    }
    const { value, selectionStart: start, selectionEnd: end } = input;
    const before = value.slice(0, start ?? value.length);
    const after = value.slice(end ?? value.length);
    const next = this.#clean(before + this.#clean(text) + after);
    input.value = next;
    const at = Math.min((before + this.#clean(text)).length, next.length);
    input.setSelectionRange(at, at);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  /** A press on a slot puts the caret there (or after the last character typed). */
  #onPress = (event: PointerEvent) => {
    const input = this.input;
    if (!input || input.disabled || event.button !== 0) return;
    const slots = this.slots;
    const index = slots.findIndex((slot) => {
      const box = slot.getBoundingClientRect();
      return event.clientX >= box.left && event.clientX <= box.right;
    });
    if (index === -1) return;
    event.preventDefault();
    input.focus();
    const at = Math.min(index, input.value.length);
    input.setSelectionRange(at, at);
    this.#sync();
  };

  #onFocus = () => this.#sync();

  #onSelection = () => {
    if (document.activeElement === this.input) this.#sync();
  };

  /** A form reset puts the input back without an `input` event: the slots follow it. */
  #onReset = (event: Event) => {
    if (this.input?.form !== event.target) return;
    setTimeout(() => {
      this.#completed = this.value.length === this.#length ? this.value : "";
      this.#sync();
    });
  };
}

if (!customElements.get("lu-otp-field")) customElements.define("lu-otp-field", OTPFieldElement);
