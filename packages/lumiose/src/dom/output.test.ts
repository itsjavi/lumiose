// @vitest-environment happy-dom
// `outputTemplate` (TASK-425): a form reset skips the outputs whose text it would not change, so
// Firefox and WebKit, which replace an output's children on every reset, keep the nodes bindings
// update. The browsers' side runs in examples/ui-e2e (form.e2e.ts, Firefox and WebKit projects).
import { afterEach, describe, expect, it } from "vitest";
import { outputTemplate, setText } from "./index.ts";

afterEach(() => {
  document.body.textContent = "";
});

/**
 * The `form` attribute of each output while the reset event is dispatched, then after the next
 * task. happy-dom implements neither form owners from that attribute nor outputs' default values,
 * so the tests stub `defaultValue` and read the attribute the runtime sets.
 */
async function reset(form: HTMLFormElement, outputs: HTMLOutputElement[]) {
  let during: (string | null)[] = [];
  form.addEventListener("reset", () => (during = outputs.map((o) => o.getAttribute("form"))), {
    once: true,
  });
  form.dispatchEvent(new Event("reset", { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve));
  return { during, after: outputs.map((output) => output.getAttribute("form")) };
}

/** An output's default value as a browser reports it. */
function stubDefault(output: HTMLOutputElement, value: () => string) {
  Object.defineProperty(output, "defaultValue", { get: value });
}

describe("outputTemplate", () => {
  it("creates the template's nodes like template()", () => {
    const t = outputTemplate(`<form><output>0 items`);
    const form = t();
    expect(form.outerHTML).toBe("<form><output>0 items</output></form>");
    expect(t()).not.toBe(form);
  });

  it("keeps an output whose text a reset would not change out of the form until the reset ran", async () => {
    const form = outputTemplate(
      `<form><output> </output><output form=f2>b</output>`,
    )() as HTMLFormElement;
    form.id = "f2";
    document.body.append(form);
    const [live, named] = [...form.querySelectorAll("output")];
    // A binding wrote the text: without a `value` set by a script, the default value is the text.
    setText(live!.firstChild as Text, "3 items");
    stubDefault(live!, () => live!.textContent!);
    stubDefault(named!, () => named!.textContent!);
    const { during, after } = await reset(form, [live!, named!]);
    // An empty `form` attribute names no form; the output's own attribute comes back after.
    expect(during).toEqual(["", ""]);
    expect(after).toEqual([null, "f2"]);
  });

  it("leaves an output whose reset changes its text to the reset", async () => {
    const form = outputTemplate(`<form><output>changed`)() as HTMLFormElement;
    document.body.append(form);
    const output = form.querySelector("output")!;
    stubDefault(output, () => "start");
    const { during } = await reset(form, [output]);
    expect(during).toEqual([null]);
  });
});
