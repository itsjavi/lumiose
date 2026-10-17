// @vitest-environment happy-dom
// The watcher of anchored popups (TASK-453 L28, TASK-475): it finds the trigger through the
// anchor names in `style`, through the computed style when a strict CSP moved them into a
// stylesheet, or as the trigger `place` was given. happy-dom has no anchor positioning and no
// layout; examples/ui-e2e checks the hiding itself in the browsers.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { place } from "./place.ts";

let observed: Element[];
let report: (target: Element, isIntersecting: boolean) => void;

beforeEach(() => {
  observed = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        report = (target, isIntersecting) => callback([{ target, isIntersecting }]);
      }
      observe(target: Element) {
        observed.push(target);
      }
      unobserve(target: Element) {
        observed = observed.filter((each) => each !== target);
      }
    },
  );
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const toggle = (popup: HTMLElement, newState: "open" | "closed") =>
  popup.dispatchEvent(Object.assign(new Event("toggle"), { newState }));

it("finds the trigger by the anchor names in style attributes", () => {
  document.body.innerHTML = `<button id="t" style="anchor-name: --lu-a">Open</button>
    <div id="p" popover data-side="bottom" style="position-anchor: --lu-a">Popup</div>`;
  const popup = document.getElementById("p")!;
  toggle(popup, "open");
  expect(observed).toEqual([document.getElementById("t")]);
  report(document.getElementById("t")!, false);
  expect(popup.hasAttribute("data-anchor-hidden")).toBe(true);
  toggle(popup, "closed");
  expect(popup.hasAttribute("data-anchor-hidden")).toBe(false);
  expect(observed).toEqual([]);
});

it("watches the trigger place() was given, when no anchor name can be read", () => {
  // A strict CSP's stylesheet rules, which a browser without anchor positioning drops.
  document.body.innerHTML = `<button id="t" data-l-v="0">Open</button>
    <div id="p" popover data-side="bottom" data-l-v="1">Popup</div>`;
  const popup = document.getElementById("p")!;
  const trigger = document.getElementById("t")!;
  vi.spyOn(popup, "matches").mockImplementation((selectors) => selectors.includes("[popover]"));
  toggle(popup, "open");
  expect(observed).toEqual([]);
  place(popup, trigger);
  place(popup, trigger);
  expect(observed).toEqual([trigger]);
  report(trigger, false);
  expect(popup.hasAttribute("data-anchor-hidden")).toBe(true);
  toggle(popup, "closed");
  expect(observed).toEqual([]);
});
