// Scroll Area's client script (decision-62, decision-63): it defines `<lu-scroll-area>`, the
// light-DOM element ScrollArea.Root renders, after Base UI's ScrollArea. Scrolling stays native:
// the `[data-viewport]` scrolls with the wheel, touch, the keyboard (it is focusable while it
// overflows) and find-in-page, and nothing traps focus. CSS alone can only recolour and thin the
// native scrollbar (`scrollbar-color`, `scrollbar-width`, `scrollbar-gutter`), not shape it, lay it
// over the content or show it on hover; so the element hides the native scrollbar once it runs
// (scroll-area.css) and draws its own, which are pointer conveniences (`aria-hidden`). Without
// JavaScript the native scrollbars show.
//
// - On every scroll and resize: `data-has-overflow-x` and `-y`, `data-overflow-{x,y}-{start,end}`
//   (more than `overflow-edge-threshold` px of content past that edge) on the element and the
//   viewport; the distances as `--lu-scroll-area-overflow-{x,y}-{start,end}` on the viewport; each
//   `[data-scrollbar]` hidden while its axis does not overflow (unless `data-keep-mounted`), its
//   `[data-thumb]` sized (`--lu-scroll-area-thumb-height` or `-width`) and moved with `transform`;
//   the `[data-corner]` shown when both overflow, its size as `--lu-scroll-area-corner-width` and
//   `-height` on the element.
// - `data-scrolling` while scrolling (and 500 ms after), `data-hovering` on the scrollbars while
//   the pointer is over the area.
// - Dragging a thumb scrolls with it; a press on a scrollbar's track scrolls there. The wheel over
//   a scrollbar scrolls the viewport (which the scrollbar is not inside), and the page only once
//   the viewport cannot scroll that way (TASK-437 M18); a pinch zoom (Ctrl) is the page's.
// - Right to left, a horizontal thumb runs from the right.
//
// It must not import `lumiose`: server-rendered pages load it without the runtime.

/** The smallest thumb, in px, so it stays easy to grab. */
const MIN_THUMB = 16;
/** How long `data-scrolling` stays after the last scroll. */
const SCROLLING = 500;

type Axis = "x" | "y";

export class ScrollAreaElement extends HTMLElement {
  #resize: ResizeObserver | undefined;
  #observed: Element[] = [];
  #scrolling: ReturnType<typeof setTimeout> | undefined;
  #frame = 0;
  /** The scrollbars that listen to the wheel. */
  #wheeled = new WeakSet<HTMLElement>();

  /** The scrolling element. */
  get viewport(): HTMLElement | null {
    return this.#own<HTMLElement>("[data-viewport]")[0] ?? null;
  }

  #own<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter(
      (node) => node.closest("lu-scroll-area") === this,
    );
  }

  #scrollbar(axis: Axis): HTMLElement | undefined {
    const orientation = axis === "y" ? "vertical" : "horizontal";
    return this.#own<HTMLElement>(`[data-scrollbar][data-orientation="${orientation}"]`)[0];
  }

  connectedCallback(): void {
    this.addEventListener("scroll", this.#onScroll, true);
    this.addEventListener("pointerdown", this.#onPress);
    this.addEventListener("pointerenter", this.#onHover);
    this.addEventListener("pointerleave", this.#onHover);
    this.#resize ??= new ResizeObserver(() => this.#schedule());
    const settle = () => {
      this.#observe();
      this.#update();
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", settle, { once: true });
    } else queueMicrotask(settle);
  }

  disconnectedCallback(): void {
    this.removeEventListener("scroll", this.#onScroll, true);
    this.removeEventListener("pointerdown", this.#onPress);
    this.removeEventListener("pointerenter", this.#onHover);
    this.removeEventListener("pointerleave", this.#onHover);
    this.#resize?.disconnect();
    this.#observed = [];
    cancelAnimationFrame(this.#frame);
  }

  /** Watches the viewport and its content for size changes. */
  #observe(): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const targets = [viewport, ...viewport.children];
    if (
      targets.length === this.#observed.length &&
      targets.every((t, i) => t === this.#observed[i])
    ) {
      return;
    }
    this.#resize?.disconnect();
    for (const target of targets) this.#resize?.observe(target);
    this.#observed = targets;
  }

  #schedule(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      this.#observe();
      this.#update();
    });
  }

  /** Whether a horizontal scroll position counts from the right (right to left). */
  #rtl(viewport: HTMLElement): boolean {
    return getComputedStyle(viewport).direction === "rtl";
  }

  /** Writes the overflow state, the thumbs and the corner from the viewport's scroll position. */
  #update(): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const threshold = Number(this.getAttribute("overflow-edge-threshold")) || 0;
    const { scrollWidth, scrollHeight, clientWidth, clientHeight } = viewport;
    const left = Math.abs(viewport.scrollLeft);
    const top = viewport.scrollTop;
    const distances = {
      "x-start": left,
      "x-end": Math.max(0, scrollWidth - clientWidth - left),
      "y-start": top,
      "y-end": Math.max(0, scrollHeight - clientHeight - top),
    };
    const has = { x: scrollWidth > clientWidth + 1, y: scrollHeight > clientHeight + 1 };
    for (const target of [this, viewport]) {
      target.toggleAttribute("data-has-overflow-x", has.x);
      target.toggleAttribute("data-has-overflow-y", has.y);
      for (const [edge, distance] of Object.entries(distances)) {
        target.toggleAttribute(`data-overflow-${edge}`, distance > threshold);
      }
    }
    for (const [edge, distance] of Object.entries(distances)) {
      viewport.style.setProperty(`--lu-scroll-area-overflow-${edge}`, `${Math.round(distance)}px`);
    }
    // Focusable while there is something to scroll with the keyboard.
    const scrollable = has.x || has.y;
    if (viewport.tabIndex !== (scrollable ? 0 : -1)) viewport.tabIndex = scrollable ? 0 : -1;
    for (const axis of ["x", "y"] as const) this.#thumb(axis, viewport, has[axis]);
    const vertical = this.#scrollbar("y");
    const horizontal = this.#scrollbar("x");
    for (const corner of this.#own<HTMLElement>("[data-corner]")) corner.hidden = !(has.x && has.y);
    this.style.setProperty(
      "--lu-scroll-area-corner-width",
      `${has.x && has.y && vertical ? vertical.offsetWidth : 0}px`,
    );
    this.style.setProperty(
      "--lu-scroll-area-corner-height",
      `${has.x && has.y && horizontal ? horizontal.offsetHeight : 0}px`,
    );
  }

  /** Sizes and moves `axis`'s thumb, and shows its scrollbar while that axis overflows. */
  #thumb(axis: Axis, viewport: HTMLElement, overflows: boolean): void {
    const scrollbar = this.#scrollbar(axis);
    if (!scrollbar) return;
    if (!this.#wheeled.has(scrollbar)) {
      // Not passive: a wheel the viewport takes must not scroll the page too.
      scrollbar.addEventListener("wheel", this.#onWheel, { passive: false });
      this.#wheeled.add(scrollbar);
    }
    scrollbar.hidden = !overflows && !scrollbar.hasAttribute("data-keep-mounted");
    const thumb = scrollbar.querySelector<HTMLElement>("[data-thumb]");
    if (!thumb || scrollbar.hidden) return;
    const vertical = axis === "y";
    const track = vertical ? scrollbar.clientHeight : scrollbar.clientWidth;
    const view = vertical ? viewport.clientHeight : viewport.clientWidth;
    const content = vertical ? viewport.scrollHeight : viewport.scrollWidth;
    const position = vertical ? viewport.scrollTop : Math.abs(viewport.scrollLeft);
    const size = content > 0 ? Math.max(MIN_THUMB, Math.min(track, (view / content) * track)) : 0;
    const room = Math.max(0, content - view);
    const offset = room > 0 ? (position / room) * (track - size) : 0;
    const name = vertical ? "--lu-scroll-area-thumb-height" : "--lu-scroll-area-thumb-width";
    scrollbar.style.setProperty(name, `${size}px`);
    thumb.style.setProperty(name, `${size}px`);
    const rtl = !vertical && this.#rtl(viewport);
    thumb.style.transform = vertical
      ? `translate3d(0, ${offset}px, 0)`
      : `translate3d(${rtl ? -offset : offset}px, 0, 0)`;
  }

  #onScroll = (event: Event) => {
    const viewport = this.viewport;
    if (event.target !== viewport || !viewport) return;
    this.#update();
    this.toggleAttribute("data-scrolling", true);
    for (const scrollbar of this.#own<HTMLElement>("[data-scrollbar]")) {
      scrollbar.toggleAttribute("data-scrolling", true);
    }
    clearTimeout(this.#scrolling);
    this.#scrolling = setTimeout(() => {
      this.removeAttribute("data-scrolling");
      for (const scrollbar of this.#own<HTMLElement>("[data-scrollbar]")) {
        scrollbar.removeAttribute("data-scrolling");
      }
    }, SCROLLING);
  };

  /** The wheel over a scrollbar scrolls the viewport, in pixels, lines or pages. */
  #onWheel = (event: WheelEvent) => {
    const viewport = this.viewport;
    if (!viewport || event.ctrlKey) return;
    const line = Number.parseFloat(getComputedStyle(viewport).lineHeight) || 16;
    const [x, y] =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? [line, line]
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? [viewport.clientWidth, viewport.clientHeight]
          : [1, 1];
    const { scrollLeft, scrollTop } = viewport;
    // Instant even under `scroll-behavior: smooth`, so the new position can be read back.
    viewport.scrollBy({ left: event.deltaX * x, top: event.deltaY * y, behavior: "instant" });
    if (viewport.scrollLeft !== scrollLeft || viewport.scrollTop !== scrollTop) {
      event.preventDefault();
    }
  };

  #onHover = (event: PointerEvent) => {
    const over = event.type === "pointerenter";
    for (const scrollbar of this.#own<HTMLElement>("[data-scrollbar]")) {
      scrollbar.toggleAttribute("data-hovering", over);
    }
  };

  /** Dragging a thumb scrolls with it; a press on a track scrolls to put the thumb there. */
  #onPress = (event: PointerEvent) => {
    const viewport = this.viewport;
    const target = event.target as Element;
    const scrollbar = target.closest?.<HTMLElement>("[data-scrollbar]");
    if (!viewport || !scrollbar || !this.contains(scrollbar) || event.button !== 0) return;
    const thumb = scrollbar.querySelector<HTMLElement>("[data-thumb]");
    if (!thumb) return;
    event.preventDefault();
    const vertical = scrollbar.dataset.orientation === "vertical";
    const rtl = !vertical && this.#rtl(viewport);
    const sign = rtl ? -1 : 1;
    const track = vertical ? scrollbar.clientHeight : scrollbar.clientWidth;
    const size = vertical ? thumb.offsetHeight : thumb.offsetWidth;
    const room = vertical
      ? viewport.scrollHeight - viewport.clientHeight
      : viewport.scrollWidth - viewport.clientWidth;
    const ratio = track > size ? room / (track - size) : 0;
    const coordinate = (e: PointerEvent) => (vertical ? e.clientY : e.clientX);
    const scrollTo = (position: number) => {
      const clamped = Math.max(0, Math.min(room, position));
      if (vertical) viewport.scrollTop = clamped;
      else viewport.scrollLeft = clamped * sign;
    };
    if (!thumb.contains(target)) {
      // A press on the track: the thumb's middle goes under the pointer.
      const box = scrollbar.getBoundingClientRect();
      const from = vertical ? box.top : rtl ? box.right : box.left;
      const along = (coordinate(event) - from) * sign;
      scrollTo((along - size / 2) * ratio);
      return;
    }
    const start = coordinate(event);
    const origin = vertical ? viewport.scrollTop : Math.abs(viewport.scrollLeft);
    thumb.setPointerCapture?.(event.pointerId);
    thumb.toggleAttribute("data-scrolling", true);
    const move = (next: PointerEvent) => {
      if (next.pointerId === event.pointerId) {
        scrollTo(origin + (coordinate(next) - start) * sign * ratio);
      }
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", end);
      thumb.removeEventListener("pointercancel", end);
      thumb.removeAttribute("data-scrolling");
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", end);
    thumb.addEventListener("pointercancel", end);
  };
}

if (!customElements.get("lu-scroll-area")) {
  customElements.define("lu-scroll-area", ScrollAreaElement);
}
