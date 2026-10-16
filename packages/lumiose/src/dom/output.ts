// `<output>` elements and form resets (TASK-425). A form reset sets each `<output>`'s text to its
// default value, its text while no script set `value`. Firefox and WebKit replace its children
// even when that text is the one it already shows (Chromium leaves it alone), so the nodes the
// runtime updates (text, regions, elements) leave the document and later updates go nowhere.
// The compiler creates templates with an `<output>` through `outputTemplate`: their first instance
// installs one capturing `reset` listener, which keeps such outputs out of the reset (the reset
// runs right after the event) and puts them back in the form after it. Bundles without an
// `<output>` carry none of this.
import type { MultiRootTemplateFactory, TemplateFactory } from "../contract/client.ts";
import { template } from "./template.ts";

let listening = false;

/** `template()` for HTML with an `<output>`: also keeps outputs' nodes through form resets. */
export function outputTemplate(html: string): TemplateFactory;
export function outputTemplate(
  html: string,
  flags: number,
): TemplateFactory | MultiRootTemplateFactory;
export function outputTemplate(
  html: string,
  flags = 0,
): TemplateFactory | MultiRootTemplateFactory {
  const factory = template(html, flags);
  return (() => {
    if (!listening) {
      listening = true;
      document.addEventListener("reset", keepOutputs, true);
    }
    return factory();
  }) as TemplateFactory;
}

/**
 * Before a form resets: its outputs whose reset would not change their text leave the form (an
 * empty `form` attribute names no form) until the next task, so the reset skips them.
 */
function keepOutputs(event: Event): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const kept: [HTMLOutputElement, string | null][] = [];
  // A copy: `form.elements` is live, and an output leaves it as its `form` attribute is set.
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLOutputElement && element.value === element.defaultValue) {
      kept.push([element, element.getAttribute("form")]);
      element.setAttribute("form", "");
    }
  }
  if (kept.length === 0) return;
  setTimeout(() => {
    for (const [element, owner] of kept) {
      if (owner === null) element.removeAttribute("form");
      else element.setAttribute("form", owner);
    }
  });
}
