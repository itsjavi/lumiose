// @vitest-environment happy-dom
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { expect, it } from "vitest";
import { Account } from "../src/components/Account.stsx";

it("signs in and out repeatedly", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = render(() => <Account />, container);
  const signIn = (name: string) => {
    const input = container.querySelector<HTMLInputElement>(".login input")!;
    input.value = name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    container
      .querySelector(".login")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    flush();
  };
  const welcome = () =>
    container.querySelector(".welcome")?.textContent?.replace(/\s+/g, " ").trim();

  expect(container.querySelector(".login")).not.toBeNull();
  signIn("Ada");
  expect(container.querySelector(".login")).toBeNull();
  expect(welcome()).toMatch(/^Signed in as Ada\./);
  container.querySelector<HTMLButtonElement>(".welcome button")!.click();
  flush();
  expect(container.querySelector(".welcome")).toBeNull();
  expect(container.querySelector(".login")).not.toBeNull();
  signIn("Grace");
  expect(welcome()).toMatch(/^Signed in as Grace\./);
  dispose();
  container.remove();
});
