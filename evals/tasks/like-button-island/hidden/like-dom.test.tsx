// @vitest-environment happy-dom
import { flushSync } from "lumen";
import { mount } from "lumen/dom";
import { expect, it } from "vitest";
import { LikeButton } from "../src/components/LikeButton.stsx";

it("toggles a like", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(() => <LikeButton count={12} />, container);
  const button = container.querySelector("button")!;
  const state = () => [button.textContent!.replace(/\s+/g, " ").trim(), button.getAttribute("aria-pressed")];
  expect(state()).toEqual(["♥ 12", "false"]);
  button.click();
  flushSync();
  expect(state()).toEqual(["♥ 13", "true"]);
  button.click();
  flushSync();
  expect(state()).toEqual(["♥ 12", "false"]);
  dispose();
  container.remove();
});
