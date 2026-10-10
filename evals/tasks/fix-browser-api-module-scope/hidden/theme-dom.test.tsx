// @vitest-environment happy-dom
import { flushSync } from "lumiose";
import { mount } from "lumiose/dom";
import { expect, it } from "vitest";

it("reads the saved theme after mounting and saves changes", async () => {
  localStorage.setItem("theme", "dark");
  const { ThemeToggle } = await import("../src/components/ThemeToggle.stsx");
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(() => <ThemeToggle />, container);
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
  const button = container.querySelector("button")!;
  expect(button.textContent!.trim()).toBe("Theme: dark");
  button.click();
  flushSync();
  expect(button.textContent!.trim()).toBe("Theme: light");
  expect(localStorage.getItem("theme")).toBe("light");
  dispose();
  container.remove();
});
