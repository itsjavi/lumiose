// @vitest-environment happy-dom
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, expect, it } from "vitest";
import { ProgressBar } from "../src/components/ProgressBar.stsx";

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function custom(container: HTMLElement): string | undefined {
  for (const el of [container, ...container.querySelectorAll<HTMLElement>("*")]) {
    const value = el.style.getPropertyValue("--progress");
    if (value) return value.trim();
    const attr = /--progress:\s*([^;]+)/.exec(el.getAttribute("style") ?? "");
    if (attr) return attr[1]!.trim();
  }
  return undefined;
}

it("sets --progress and aria-valuenow from the value, live and clamped", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const value = signal(40);
  dispose = render(() => <ProgressBar value={value()} />, container);
  const bar = () => container.querySelector('[role="progressbar"]')!;
  expect(custom(container)).toBe("40%");
  expect(bar().getAttribute("aria-valuenow")).toBe("40");
  value.set(75);
  flush();
  expect(custom(container)).toBe("75%");
  expect(bar().getAttribute("aria-valuenow")).toBe("75");
  value.set(130);
  flush();
  expect(custom(container)).toBe("100%");
  expect(bar().getAttribute("aria-valuenow")).toBe("100");
  value.set(-5);
  flush();
  expect(custom(container)).toBe("0%");
  expect(bar().getAttribute("aria-valuenow")).toBe("0");
});
