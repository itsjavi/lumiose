// @vitest-environment happy-dom
// Parts whose attributes come from a spread follow their props (TASK-477): Combobox.List's
// placement and style, Popover.Trigger's hover settings, and NumberField.Input's limits. The
// value's own ARIA on a formatted Input stays the server HTML's, which the element keeps current.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, expect, it, vi } from "vitest";
import { Combobox } from "./combobox/combobox.tsx";
import { NumberField } from "./number-field/number-field.tsx";
import { Popover } from "./popover/popover.tsx";

// happy-dom has no ElementInternals, which `<lu-combobox>` needs: a bare element stands in for it
// here, before the component's script loads (the test is about the component's attributes).
vi.hoisted(() => customElements.define("lu-combobox", class extends HTMLElement {}));

let dispose: (() => void) | undefined;

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  flush();
  return container;
}

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

it("Combobox.List follows its placement props and style", () => {
  const side = signal<"bottom" | "top">("bottom");
  const offset = signal(4);
  const style = signal("max-height: 10rem");
  const container = mount(() => (
    <Combobox.Root>
      <Combobox.Input aria-label="City" />
      <Combobox.List side={side()} sideOffset={offset()} style={style()}>
        <Combobox.Item value="ber">Berlin</Combobox.Item>
      </Combobox.List>
    </Combobox.Root>
  ));
  const list = container.querySelector<HTMLElement>("[role=listbox]")!;
  expect(list.getAttribute("data-side")).toBe("bottom");
  expect(list.style.getPropertyValue("--lu-side-offset")).toBe("4px");
  side.set("top");
  offset.set(12);
  style.set("max-height: 20rem");
  flush();
  expect(list.getAttribute("data-side")).toBe("top");
  expect(list.style.getPropertyValue("--lu-side-offset")).toBe("12px");
  expect(list.style.getPropertyValue("max-height")).toBe("20rem");
  expect(list.getAttribute("popover")).toBe("manual");
});

it("Popover.Trigger follows openOnHover, delay and closeDelay", () => {
  const hover = signal(false);
  const delay = signal(200);
  const container = mount(() => (
    <Popover.Root>
      <Popover.Trigger openOnHover={hover()} delay={delay()} closeDelay={50}>
        Profile
      </Popover.Trigger>
      <Popover.Popup>Ada</Popover.Popup>
    </Popover.Root>
  ));
  const trigger = container.querySelector("button")!;
  expect(trigger.hasAttribute("data-open-on-hover")).toBe(false);
  hover.set(true);
  flush();
  expect(trigger.hasAttribute("data-open-on-hover")).toBe(true);
  expect(trigger.getAttribute("data-delay")).toBe("200");
  expect(trigger.getAttribute("data-close-delay")).toBe("50");
  delay.set(600);
  flush();
  expect(trigger.getAttribute("data-delay")).toBe("600");
  hover.set(false);
  flush();
  expect(trigger.hasAttribute("data-open-on-hover")).toBe(false);
  expect(trigger.hasAttribute("data-delay")).toBe(false);
});

it("NumberField.Input follows the field's limits, native or formatted", () => {
  const max = signal(10);
  const container = mount(() => (
    <>
      <NumberField.Root defaultValue={5} min={0} max={max()} step={2}>
        <NumberField.Input aria-label="Native" />
      </NumberField.Root>
      <NumberField.Root defaultValue={5} min={0} max={max()} format={{ style: "percent" }}>
        <NumberField.Input aria-label="Formatted" />
      </NumberField.Root>
    </>
  ));
  const [native, formatted] = container.querySelectorAll<HTMLInputElement>("input[aria-label]");
  expect(native!.getAttribute("max")).toBe("10");
  expect(native!.getAttribute("step")).toBe("2");
  expect(formatted!.getAttribute("aria-valuemax")).toBe("10");
  const valuetext = formatted!.getAttribute("aria-valuetext");
  max.set(20);
  flush();
  expect(native!.getAttribute("max")).toBe("20");
  expect(formatted!.getAttribute("aria-valuemax")).toBe("20");
  expect(formatted!.getAttribute("aria-valuenow")).toBe("5");
  expect(formatted!.getAttribute("aria-valuetext")).toBe(valuetext);
});
