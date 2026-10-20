// @vitest-environment happy-dom
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { expect, it } from "vitest";

it("reads the saved theme after mounting and saves changes", async () => {
  localStorage.setItem("theme", "dark");
  const { ThemeToggle } = await import("../src/components/ThemeToggle.stsx");
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = render(() => <ThemeToggle />, container);
  flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
  const button = container.querySelector("button")!;
  expect(button.textContent!.trim()).toBe("Theme: dark");
  button.click();
  flush();
  expect(button.textContent!.trim()).toBe("Theme: light");
  expect(localStorage.getItem("theme")).toBe("light");
  dispose();
  container.remove();
});
