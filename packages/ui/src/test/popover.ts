// happy-dom has no popovers: a stand-in for `showPopover`, `hidePopover` and `:popover-open`,
// enough for the components' own logic. The real top layer is checked by examples/ui-e2e.
const shown = new WeakSet<Element>();
/** The `source` each popover was last shown with. */
export const sources = new WeakMap<Element, unknown>();

export function installPopovers() {
  const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
  proto.showPopover = function (this: HTMLElement, options?: { source?: unknown }) {
    shown.add(this);
    sources.set(this, options?.source);
  };
  proto.hidePopover = function (this: HTMLElement) {
    shown.delete(this);
  };
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    return selector === ":popover-open" ? shown.has(this) : matches.call(this, selector);
  } as Element["matches"];
}

/** What the browser fires after a popover opens or closes. */
export function toggled(element: Element, newState: "open" | "closed") {
  if (newState === "open") shown.add(element);
  else shown.delete(element);
  element.dispatchEvent(
    Object.assign(new Event("toggle"), {
      newState,
      oldState: newState === "open" ? "closed" : "open",
    }),
  );
}
