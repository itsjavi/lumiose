// @vitest-environment happy-dom
import { flushSync } from "lumiose";
import { mount } from "lumiose/dom";
import { expect, it } from "vitest";
import { Shopping } from "../src/components/Shopping.stsx";

it("adds and removes items", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(() => <Shopping initial={["Bread", "Eggs"]} />, container);
  const list = () =>
    [...container.querySelectorAll("li")].map((li) => li.firstChild!.textContent!.trim());
  const count = () => container.querySelector(".count")!.textContent!.trim();
  expect(list()).toEqual(["Bread", "Eggs"]);

  const input = container.querySelector("input")!;
  input.value = "Milk";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  container
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  flushSync();
  expect(list()).toEqual(["Bread", "Eggs", "Milk"]);
  expect(count()).toBe("3 items");
  expect(input.value).toBe("");

  container.querySelectorAll<HTMLButtonElement>(".remove")[0]!.click();
  flushSync();
  expect(list()).toEqual(["Eggs", "Milk"]);
  expect(count()).toBe("2 items");
  dispose();
  container.remove();
});
