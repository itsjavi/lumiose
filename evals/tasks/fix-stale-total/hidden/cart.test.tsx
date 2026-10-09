// @vitest-environment happy-dom
import { flushSync } from "lumen";
import { mount } from "lumen/dom";
import { afterEach, expect, it } from "vitest";
import { Cart } from "../src/components/Cart.stsx";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function render() {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = mount(() => <Cart name="Notebook" price={4.5} />, container);
  const [minus, plus] = container.querySelectorAll("button");
  const read = () => ({
    quantity: container.querySelector(".quantity span")!.textContent!.replace(/\s+/g, " ").trim(),
    total: container.querySelector(".total")!.textContent!.replace(/\s+/g, " ").trim(),
  });
  return { minus: minus!, plus: plus!, read };
}

it("starts with one item", () => {
  expect(render().read()).toEqual({ quantity: "1 item", total: "Total: 4.50 €" });
});

it("updates the total and the label", () => {
  const { plus, minus, read } = render();
  plus.click();
  plus.click();
  flushSync();
  expect(read()).toEqual({ quantity: "3 items", total: "Total: 13.50 €" });
  minus.click();
  minus.click();
  minus.click();
  flushSync();
  expect(read()).toEqual({ quantity: "0 items", total: "Total: 0.00 €" });
});
