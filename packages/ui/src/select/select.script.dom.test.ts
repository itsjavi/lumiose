// @vitest-environment happy-dom
// select.script.ts (TASK-537): a customizable select's labelled items lose their `label` attribute
// as it is pressed or focused, so its picker shows their content; a classic select keeps them.
// happy-dom has no customizable select: the computed `appearance` is stubbed. Chromium's picker is
// checked by examples/ui-e2e.
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const item = (value: string, label: string) =>
  `<option value="${value}" label="${label}"><span hidden data-label="">${label}</span>★ ${label}</option>`;

beforeAll(async () => {
  document.body.innerHTML = `
    <select id="custom">${item("a", "Alpha")}<option value="b" label="Beta">Beta</option></select>
    <select id="classic">${item("c", "Gamma")}</select>`;
  const native = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = native(element);
    if ((element as Element).id !== "custom") return style;
    return new Proxy(style, {
      get: (target, key) => (key === "appearance" ? "base-select" : Reflect.get(target, key)),
    });
  });
  await import("./select.script.ts");
});

afterAll(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const labels = (id: string) =>
  [...document.querySelectorAll(`#${id} option`)].map((option) => option.getAttribute("label"));

it("removes a customizable select's item labels as it takes focus, and only Select.Item's", () => {
  expect(labels("custom")).toEqual(["Alpha", "Beta"]);
  document.getElementById("custom")!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  // A plain `<option label>` is not Select.Item's: it keeps its label.
  expect(labels("custom")).toEqual([null, "Beta"]);
});

it("leaves a classic select's labels, which it shows", () => {
  const classic = document.getElementById("classic")!;
  classic.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  classic.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(labels("classic")).toEqual(["Gamma"]);
});
