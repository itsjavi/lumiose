// @vitest-environment happy-dom
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { expect, it } from "vitest";
import { PriceEditor } from "../src/components/PriceEditor.stsx";

it("formats what you type", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = render(() => <PriceEditor initial={9.5} />, container);
  const output = () => container.querySelector("output")!.textContent!.trim();
  expect(output()).toBe("9.50 €");
  const input = container.querySelector("input")!;
  input.value = "12";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  flush();
  expect(output()).toBe("12.00 €");
  dispose();
  container.remove();
});
