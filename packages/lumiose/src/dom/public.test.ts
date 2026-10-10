// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, onCleanup, signal } from "../core/index.ts";
import { createComponent, insert, render, template } from "./index.ts";
import { Dynamic, Portal } from "./public.ts";

afterEach(() => {
  document.body.textContent = "";
});

describe("Portal", () => {
  it("renders reactive children into mount (default body) and removes them on disposal", () => {
    const target = document.createElement("aside");
    document.body.appendChild(target);
    const app = document.createElement("div");
    const label = signal("one");
    const dispose = render(
      () => [
        createComponent(Portal, {
          get children() {
            return label();
          },
        }),
        createComponent(Portal, { mount: target, children: template(`<b>in target`)() }),
      ],
      app,
    );
    expect(app.childNodes.length).toBe(2);
    expect(app.textContent).toBe("");
    const container = document.body.lastElementChild!;
    expect(container.textContent).toBe("one");
    label.set("two");
    flush();
    expect(container.textContent).toBe("two");
    expect(target.innerHTML).toBe("<div><b>in target</b></div>");
    dispose();
    expect(container.isConnected).toBe(false);
    expect(target.innerHTML).toBe("");
  });
});

describe("Dynamic", () => {
  it("renders a component or an intrinsic tag and re-creates it only when component changes", () => {
    const log: string[] = [];
    const A = (props: { label: string }): Renderable => {
      log.push(`A ${props.label}`);
      onCleanup(() => log.push("A cleanup"));
      const el = template(`<i>`)();
      insert(el, () => props.label);
      return el;
    };
    const B = (): Renderable => {
      log.push("B");
      return "b";
    };
    const which = signal<unknown>(A);
    const label = signal("x");
    const app = document.createElement("div");
    render(
      () =>
        createComponent(Dynamic, {
          get component() {
            return which() as never;
          },
          get label() {
            return label();
          },
          get title() {
            return label();
          },
          get children() {
            return "child";
          },
        }),
      app,
    );
    expect(app.innerHTML).toBe("<i>x</i>");
    label.set("y");
    flush();
    expect(app.innerHTML).toBe("<i>y</i>");
    which.set(B);
    flush();
    expect(app.innerHTML).toBe("b");
    expect(log).toEqual(["A x", "A cleanup", "B"]);
    which.set("section");
    flush();
    expect(app.innerHTML).toBe(`<section label="y" title="y">child</section>`);
    label.set("z");
    flush();
    expect(app.innerHTML).toBe(`<section label="z" title="z">child</section>`);
    which.set(null);
    flush();
    expect(app.innerHTML).toBe("");
  });
});
