// @vitest-environment happy-dom
import { flushSync } from "lumiose";
import { mount } from "lumiose/dom";
import { expect, it } from "vitest";
import { Counter } from "../src/components/Counter.stsx";

it("still counts by its step", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(() => <Counter start={10} step={5} />, container);
  const [minus, plus] = container.querySelectorAll("button");
  plus!.click();
  plus!.click();
  minus!.click();
  flushSync();
  expect(container.querySelector("output")!.textContent).toBe("15");
  dispose();
  container.remove();
});
