// @vitest-environment happy-dom
// `<lu-tabs>` on server HTML (TASK-359): the keys, the selection and `valuechange`, as a page
// without islands gets them. The real browser is checked by examples/ui-e2e.
import { afterEach, beforeAll, expect, it } from "vitest";
import type { LuTabs } from "./tabs.script.ts";

beforeAll(async () => {
  await import("./tabs.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(
  options: { list?: string; selected?: string; disabled?: string[]; indicator?: boolean } = {},
): LuTabs {
  const values = ["a", "b", "c"];
  const selected = options.selected ?? "a";
  document.body.innerHTML = `<lu-tabs><div role="tablist" ${options.list ?? ""}>${values
    .map(
      (v) =>
        `<button role="tab" value="${v}" id="t-${v}" aria-controls="p-${v}" aria-selected="${v === selected}" tabindex="${v === selected ? 0 : -1}"${options.disabled?.includes(v) ? ' aria-disabled="true"' : ""}>${v}</button>`,
    )
    .join(
      "",
    )}${options.indicator ? "<span aria-hidden=true data-indicator></span>" : ""}</div>${values
    .map((v) => `<div role="tabpanel" id="p-${v}"${v === selected ? "" : " hidden"}>${v}</div>`)
    .join("")}</lu-tabs>`;
  return document.querySelector("lu-tabs") as LuTabs;
}

const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
  );
const tab = (value: string) => document.getElementById(`t-${value}`) as HTMLElement;

it("reads and sets the selection through value", () => {
  const tabs = mount();
  expect(tabs.value).toBe("a");
  tabs.value = "c";
  expect(tab("c").getAttribute("aria-selected")).toBe("true");
  expect(tab("c").tabIndex).toBe(0);
  expect(tab("a").tabIndex).toBe(-1);
  expect(document.getElementById("p-c")!.hidden).toBe(false);
  expect(document.getElementById("p-a")!.hidden).toBe(true);
});

it("moves focus with the arrows and Home and End, looping, without selecting", () => {
  const tabs = mount();
  tab("a").focus();
  key(tab("a"), "ArrowRight");
  expect(document.activeElement).toBe(tab("b"));
  key(tab("b"), "End");
  expect(document.activeElement).toBe(tab("c"));
  key(tab("c"), "ArrowRight");
  expect(document.activeElement).toBe(tab("a"));
  key(tab("a"), "ArrowLeft");
  expect(document.activeElement).toBe(tab("c"));
  key(tab("c"), "Home");
  expect(document.activeElement).toBe(tab("a"));
  expect(tabs.value).toBe("a");
});

it("selects on click and fires valuechange, not on a disabled tab", () => {
  const tabs = mount({ disabled: ["b"] });
  const changes: (string | null)[] = [];
  tabs.addEventListener("valuechange", () => changes.push(tabs.value));
  tab("b").click();
  expect(tabs.value).toBe("a");
  tab("c").click();
  tab("c").click();
  expect(changes).toEqual(["c"]);
});

it("selects on focus with data-activate-on-focus, and stops at the ends without looping", () => {
  const tabs = mount({ list: 'data-activate-on-focus data-loop-focus="false"' });
  tab("a").focus();
  key(tab("a"), "ArrowLeft");
  expect(document.activeElement).toBe(tab("a"));
  key(tab("a"), "ArrowRight");
  expect(tabs.value).toBe("b");
});

it("uses the up and down arrows when vertical", () => {
  mount({ list: 'aria-orientation="vertical"' });
  tab("a").focus();
  key(tab("a"), "ArrowRight");
  expect(document.activeElement).toBe(tab("a"));
  key(tab("a"), "ArrowDown");
  expect(document.activeElement).toBe(tab("b"));
});

it("gives a disabled selected tab's place to the first enabled tab", async () => {
  const tabs = mount({ selected: "a", disabled: ["a"] });
  await Promise.resolve();
  expect(tabs.value).toBe("b");
});

it("leaves one tab stop, on the selected tab, whatever the server HTML had (TASK-437 M17)", async () => {
  mount({ selected: "b" });
  tab("a").tabIndex = 0;
  tab("c").tabIndex = 0;
  await Promise.resolve();
  expect(["a", "b", "c"].map((value) => tab(value).tabIndex)).toEqual([-1, 0, -1]);
});

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

it("writes the selected tab's box for an indicator, on load and on selection", async () => {
  const tabs = mount({ selected: "a", indicator: true });
  const list = tabs.querySelector<HTMLElement>("[role=tablist]")!;
  list.getBoundingClientRect = () => box(10, 20, 300, 40);
  tab("a").getBoundingClientRect = () => box(10, 20, 80, 36);
  tab("b").getBoundingClientRect = () => box(90, 20, 100, 36);
  await Promise.resolve();
  const at = (name: string) => tabs.style.getPropertyValue(`--lu-tabs-indicator-${name}`);
  expect([at("left"), at("top"), at("width"), at("height")]).toEqual([
    "0px",
    "0px",
    "80px",
    "36px",
  ]);
  tab("b").click();
  expect([at("left"), at("width")]).toEqual(["80px", "100px"]);
  tabs.value = "a";
  expect(at("left")).toBe("0px");
});

it("leaves the element's style alone without an indicator", async () => {
  const tabs = mount();
  await Promise.resolve();
  tab("b").click();
  expect(tabs.style.getPropertyValue("--lu-tabs-indicator-left")).toBe("");
});
