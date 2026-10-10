// @vitest-environment happy-dom
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { expect, it } from "vitest";
import { Counter } from "../src/components/Counter.stsx";

it("still counts by its step", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = render(() => <Counter start={10} step={5} />, container);
  const [minus, plus] = container.querySelectorAll("button");
  plus!.click();
  plus!.click();
  minus!.click();
  flush();
  expect(container.querySelector("output")!.textContent).toBe("15");
  dispose();
  container.remove();
});
