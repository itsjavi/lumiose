// Slider's client script (decision-62, decision-63): it defines `<lu-slider>`, the light-DOM
// element Slider.Root renders. Each thumb is a native `<input type="range">`: the platform drags
// it, moves it with the arrow keys, Home and End, follows the direction and submits its value, in
// server HTML and without JavaScript. The element adds what Base UI's Slider does beyond that
// (doc-9 section 14):
//
// - `--lu-slider-start` and `--lu-slider-end` on the element, the selected part of the track (from
//   the start to the thumb, or between two thumbs), which the Indicator part spans.
// - Two thumbs or more: the values stay in order, `min-steps-between-values` steps apart, and a
//   thumb pushes its neighbour (`thumb-collision-behavior="push"`, the default) or stops at it
//   (`"none"`). With `"swap"`, a thumb dragged past another trades places with it: the drag goes
//   on with the thumb that holds the dragged value, which takes focus (the keys stop at the other
//   thumb, as with `"none"`). A native drag keeps its own thumb, so that thumb stays put and hands
//   its value to the other one, which takes focus when the press ends (Firefox ends a native drag
//   whose thumb loses focus). Presses on the track move the nearest thumb, and a drag goes on from
//   there.
// - Page Up and Page Down, and Shift with an arrow key, move by `large-step` (default 10). The
//   arrow keys are the element's too: Up and Right step up (Left right to left), Down and Left
//   down, the same in every browser (WebKit's native range does not mirror them right to left,
//   TASK-418).
// - The values as text: `aria-valuetext` on the thumbs when the element has a `format`
//   (`Intl.NumberFormat` options, JSON), and the Value part (an `<output for>` the thumbs) unless
//   it renders content of its own (then it has no `for`).
// - After a form reset, which moves the thumbs back without an `input` event, the track and the
//   text follow them.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

import { formatValues } from "./format.ts";

const THUMB = "input[type=range]";

const number = (value: string | null, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

export class SliderElement extends HTMLElement {
  /** The thumb a press on the track is dragging, until the press ends. */
  #dragging: HTMLInputElement | undefined;
  /** A thumb the pointer drags itself (the native drag), until the press ends. */
  #pressed: HTMLInputElement | undefined;
  /** After a swap, the thumb `#pressed`'s drag moves instead, and the value `#pressed` keeps. */
  #proxy: { target: HTMLInputElement; value: string } | undefined;

  /** The element's own thumbs, in order. */
  get thumbs(): HTMLInputElement[] {
    return [...this.querySelectorAll<HTMLInputElement>(THUMB)].filter(
      (thumb) => thumb.closest("lu-slider") === this,
    );
  }

  /** The value, or the values with two thumbs or more. Setting it moves the thumbs, without events. */
  get value(): number | number[] {
    const values = this.thumbs.map((thumb) => thumb.valueAsNumber);
    return values.length === 1 ? values[0]! : values;
  }

  set value(next: number | readonly number[] | null | undefined) {
    if (next == null) return;
    const values = typeof next === "number" ? [next] : next;
    this.thumbs.forEach((thumb, i) => {
      if (values[i] !== undefined) thumb.value = String(values[i]);
    });
    this.#sync();
  }

  connectedCallback(): void {
    this.addEventListener("input", this.#onInput);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("pointerdown", this.#onPress);
    document.addEventListener("reset", this.#onReset, true);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.#sync(), { once: true });
    } else queueMicrotask(() => this.#sync());
  }

  disconnectedCallback(): void {
    this.removeEventListener("input", this.#onInput);
    this.removeEventListener("keydown", this.#onKeyDown);
    this.removeEventListener("pointerdown", this.#onPress);
    document.removeEventListener("reset", this.#onReset, true);
  }

  #range(thumb: HTMLInputElement) {
    const min = number(thumb.min, 0);
    const max = number(thumb.max, 100);
    const step = thumb.step === "any" ? 1 : number(thumb.step, 1);
    return { min, max, step };
  }

  /** Keeps two thumbs or more in order and apart, moving the others (push) or `moved` (none). */
  #constrain(moved: HTMLInputElement): void {
    const thumbs = this.thumbs;
    if (thumbs.length < 2) return;
    const mode = this.getAttribute("thumb-collision-behavior");
    if (mode === "swap" && (this.#pressed || this.#dragging)) return this.#swap(moved);
    const i = thumbs.indexOf(moved);
    const { step } = this.#range(moved);
    const gap = number(this.getAttribute("min-steps-between-values"), 0) * step;
    const push = mode !== "none" && mode !== "swap";
    // Toward the end: each next thumb at least `gap` above the one before.
    for (let j = i + 1; j < thumbs.length; j++) {
      const floor = thumbs[j - 1]!.valueAsNumber + gap;
      if (thumbs[j]!.valueAsNumber >= floor) break;
      if (push) thumbs[j]!.value = String(floor);
      if (!push || thumbs[j]!.valueAsNumber < floor) {
        // It could not move (or must not): the moved thumb stops below it.
        moved.value = String(thumbs[j]!.valueAsNumber - gap * (j - i));
        break;
      }
    }
    // Toward the start.
    for (let j = i - 1; j >= 0; j--) {
      const ceiling = thumbs[j + 1]!.valueAsNumber - gap;
      if (thumbs[j]!.valueAsNumber <= ceiling) break;
      if (push) thumbs[j]!.value = String(ceiling);
      if (!push || thumbs[j]!.valueAsNumber > ceiling) {
        moved.value = String(thumbs[j]!.valueAsNumber + gap * (i - j));
        break;
      }
    }
  }

  /**
   * Swap: `moved`, dragged past other thumbs, trades places with them, so the values stay in order
   * and the dragged value moves on with another thumb. The drag and focus follow it.
   */
  #swap(moved: HTMLInputElement): void {
    const thumbs = this.thumbs;
    const value = moved.value;
    const dragged = moved.valueAsNumber;
    let i = thumbs.indexOf(moved);
    while (i < thumbs.length - 1 && dragged > thumbs[i + 1]!.valueAsNumber) {
      thumbs[i]!.value = thumbs[i + 1]!.value;
      thumbs[++i]!.value = value;
    }
    while (i > 0 && dragged < thumbs[i - 1]!.valueAsNumber) {
      thumbs[i]!.value = thumbs[i - 1]!.value;
      thumbs[--i]!.value = value;
    }
    const active = thumbs[i]!;
    if (active === moved) return;
    if (this.#dragging) this.#dragging = active;
    if (this.#pressed) {
      // The native drag goes on in its own thumb: focus follows when the press ends.
      this.#proxy =
        active === this.#pressed ? undefined : { target: active, value: this.#pressed.value };
      return;
    }
    active.focus({ preventScroll: true });
  }

  /** Writes the selected part of the track, the values' text and the Value part. */
  #sync(): void {
    const thumbs = this.thumbs;
    if (thumbs.length === 0) return;
    const { min, max } = this.#range(thumbs[0]!);
    const at = (value: number) => (max > min ? ((value - min) / (max - min)) * 100 : 0);
    const values = thumbs.map((thumb) => thumb.valueAsNumber);
    const start = values.length > 1 ? at(values[0]!) : 0;
    const end = at(values.at(-1)!);
    this.style.setProperty("--lu-slider-start", `${start}%`);
    this.style.setProperty("--lu-slider-end", `${end}%`);
    const format = this.getAttribute("format");
    const texts = formatValues(values, format, this.getAttribute("locale"));
    if (format) {
      thumbs.forEach((thumb, i) => thumb.setAttribute("aria-valuetext", texts[i]!));
    }
    // The Value part showing the values is `for` the thumbs; one with content of its own is not.
    for (const output of this.querySelectorAll("output[for]")) {
      if (output.closest("lu-slider") === this) output.textContent = texts.join(" – ");
    }
  }

  /** A form reset puts the thumbs back without an `input` event: the track and text follow. */
  #onReset = (event: Event) => {
    if (this.thumbs.some((thumb) => thumb.form === event.target)) setTimeout(() => this.#sync());
  };

  #onInput = (event: Event) => {
    let thumb = event.target as HTMLInputElement;
    if (!thumb.matches?.(THUMB) || thumb.closest("lu-slider") !== this) return;
    if (this.#proxy && thumb === this.#pressed) {
      // The dragged thumb swapped places: it stays put, and its drag moves the other thumb.
      const value = thumb.value;
      thumb.value = this.#proxy.value;
      thumb = this.#proxy.target;
      thumb.value = value;
    }
    this.#constrain(thumb);
    this.#sync();
  };

  /** Sets `thumb` to `value`, as the user would: clamped, on the step, with input and change. */
  #move(thumb: HTMLInputElement, value: number, change: boolean): void {
    const before = thumb.value;
    thumb.value = String(value);
    if (thumb.value === before) return;
    thumb.dispatchEvent(new Event("input", { bubbles: true }));
    if (change) thumb.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #onKeyDown = (event: KeyboardEvent) => {
    const thumb = event.target as HTMLInputElement;
    if (!thumb.matches?.(THUMB) || thumb.matches(":disabled") || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const large = number(this.getAttribute("large-step"), 10);
    let delta = 0;
    if (event.key === "PageUp") delta = large;
    else if (event.key === "PageDown") delta = -large;
    else if (event.key.startsWith("Arrow")) {
      // A vertical thumb's writing mode turns its own direction: only a horizontal one mirrors.
      const vertical = thumb.getAttribute("aria-orientation") === "vertical";
      const rtl = !vertical && getComputedStyle(thumb).direction === "rtl";
      const up = event.key === "ArrowUp" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
      const down = event.key === "ArrowDown" || event.key === (rtl ? "ArrowRight" : "ArrowLeft");
      const size = event.shiftKey ? large : this.#range(thumb).step;
      delta = up ? size : down ? -size : 0;
    }
    if (delta === 0) return;
    event.preventDefault();
    this.#move(thumb, thumb.valueAsNumber + delta, true);
  };

  /**
   * The value at a pointer position on the control. A native thumb travels inside its input, inset
   * by half its size, and is about as large as the input is thick.
   */
  #valueAt(event: PointerEvent, thumb: HTMLInputElement): number {
    const box = thumb.getBoundingClientRect();
    const { min, max } = this.#range(thumb);
    const vertical = thumb.getAttribute("aria-orientation") === "vertical";
    const rtl = !vertical && getComputedStyle(thumb).direction === "rtl";
    const length = vertical ? box.height : box.width;
    const size = Math.min(vertical ? box.width : box.height, length);
    const offset = vertical ? box.bottom - event.clientY : event.clientX - box.left;
    let ratio = length > size ? (offset - size / 2) / (length - size) : 0;
    if (rtl) ratio = 1 - ratio;
    return min + Math.min(1, Math.max(0, ratio)) * (max - min);
  }

  #onPress = (event: PointerEvent) => {
    // `:disabled`: a disabled fieldset around the slider disables its thumbs too (TASK-439, M30).
    const thumbs = this.thumbs.filter((thumb) => !thumb.matches(":disabled"));
    // One thumb: the native input takes presses on its whole track.
    if (thumbs.length < 2 || event.button !== 0 || !event.isPrimary) return;
    if ((event.target as Element).matches?.(THUMB)) {
      // The thumb's own drag; a swap hands it to another thumb until the press ends.
      this.#pressed = event.target as HTMLInputElement;
      const end = (next: PointerEvent) => {
        if (next.pointerId !== event.pointerId) return;
        document.removeEventListener("pointerup", end, true);
        document.removeEventListener("pointercancel", end, true);
        this.#proxy?.target.focus({ preventScroll: true });
        this.#pressed = this.#proxy = undefined;
      };
      document.addEventListener("pointerup", end, true);
      document.addEventListener("pointercancel", end, true);
      return;
    }
    const control = (event.target as Element).closest?.<HTMLElement>(`div:has(> ${THUMB})`);
    if (!control || !this.contains(control)) return;
    const value = this.#valueAt(event, thumbs[0]!);
    // The nearest thumb; between two at the same distance, the one the press is past.
    let nearest = thumbs[0]!;
    for (const thumb of thumbs) {
      if (Math.abs(thumb.valueAsNumber - value) <= Math.abs(nearest.valueAsNumber - value)) {
        if (thumb.valueAsNumber !== nearest.valueAsNumber || value > thumb.valueAsNumber) {
          nearest = thumb;
        }
      }
    }
    event.preventDefault();
    nearest.focus();
    this.#dragging = nearest;
    this.#move(nearest, value, false);
    control.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId || !this.#dragging) return;
      this.#move(this.#dragging, this.#valueAt(next, this.#dragging), false);
    };
    const up = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      control.removeEventListener("pointermove", move);
      control.removeEventListener("pointerup", up);
      control.removeEventListener("pointercancel", up);
      this.#dragging?.dispatchEvent(new Event("change", { bubbles: true }));
      this.#dragging = undefined;
    };
    control.addEventListener("pointermove", move);
    control.addEventListener("pointerup", up);
    control.addEventListener("pointercancel", up);
  };
}

if (!customElements.get("lu-slider")) customElements.define("lu-slider", SliderElement);
