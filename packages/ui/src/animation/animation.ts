// Enter and exit animations of @lumiose/ui's parts (doc-9 §1): the starting style of an element's
// first frame, and the end of its exit, whatever a stylesheet animates. Neither waits for a frame:
// a page in the background renders none (`requestAnimationFrame` never runs), and a part must
// still leave. Shared by the components and their client scripts, so it must not import
// `lumiose`.

/** Forces a style update: transitions start from what is computed now. */
const flush = (element: Element) => getComputedStyle(element).getPropertyValue("opacity");

/**
 * Applies `attribute` (`data-starting-style`) for the element's first style, then removes it, so
 * a transition runs from the starting style to the element's own.
 */
export function startFrom(element: Element, attribute = "data-starting-style"): void {
  element.setAttribute(attribute, "");
  flush(element);
  element.removeAttribute(attribute);
}

/**
 * Resolves once the element's animations and transitions end: after the longest one's remaining
 * time, so a background page (whose animations do not advance) still gets there.
 */
export function afterAnimations(element: Element): Promise<void> {
  flush(element);
  let wait = 0;
  for (const animation of element.getAnimations()) {
    const timing = animation.effect?.getComputedTiming();
    const end = Number(timing?.endTime ?? 0);
    const current = Number(animation.currentTime ?? 0);
    if (Number.isFinite(end)) wait = Math.max(wait, end - current);
  }
  return new Promise((resolve) => setTimeout(resolve, wait));
}
