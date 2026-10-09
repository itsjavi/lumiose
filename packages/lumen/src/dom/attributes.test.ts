// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushSync, signal } from "../core/index.ts";
import {
  applyScope,
  bind,
  setAttr,
  setClass,
  setNonce,
  setProp,
  setStyle,
  setStyleProperty,
  setText,
  toggleClass,
} from "./index.ts";

describe("setText", () => {
  it("writes strings and numbers; nullish and booleans render nothing", () => {
    const node = document.createTextNode("x");
    setText(node, 42);
    expect(node.data).toBe("42");
    setText(node, null);
    expect(node.data).toBe("");
    setText(node, "a");
    setText(node, false);
    expect(node.data).toBe("");
  });

  it("works as a bind apply function and only writes on change", () => {
    const node = document.createTextNode("");
    const label = signal("a");
    let writes = 0;
    bind(node, label, (n, v) => {
      writes++;
      setText(n, v);
    });
    expect(node.data).toBe("a");
    label.set("b");
    flushSync();
    expect(node.data).toBe("b");
    label.set("b");
    flushSync();
    expect(writes).toBe(2);
  });
});

describe("setAttr", () => {
  it("removes on nullish/false, sets '' on true, stringifies the rest", () => {
    const el = document.createElement("input");
    setAttr(el, "disabled", true);
    expect(el.getAttribute("disabled")).toBe("");
    setAttr(el, "disabled", false);
    expect(el.hasAttribute("disabled")).toBe(false);
    setAttr(el, "tabindex", 3);
    expect(el.getAttribute("tabindex")).toBe("3");
    setAttr(el, "tabindex", undefined);
    expect(el.hasAttribute("tabindex")).toBe(false);
    setAttr(el, "title", null);
    expect(el.hasAttribute("title")).toBe(false);
  });

  it("writes booleans of aria-* and enumerated attributes as 'true'/'false'", () => {
    const el = document.createElement("div");
    for (const name of [
      "aria-hidden",
      "aria-expanded",
      "draggable",
      "spellcheck",
      "contenteditable",
    ]) {
      setAttr(el, name, false);
      expect(el.getAttribute(name), name).toBe("false");
      setAttr(el, name, true);
      expect(el.getAttribute(name), name).toBe("true");
      setAttr(el, name, null);
      expect(el.hasAttribute(name), name).toBe(false);
    }
    setAttr(el, "aria-label", "Close");
    expect(el.getAttribute("aria-label")).toBe("Close");
  });
});

describe("setProp", () => {
  it("sets DOM properties; nullish clears string properties", () => {
    const input = document.createElement("input");
    setProp(input, "value", "hello");
    expect(input.value).toBe("hello");
    setProp(input, "value", undefined);
    expect(input.value).toBe("");
    setProp(input, "checked", true);
    expect(input.checked).toBe(true);
  });
});

describe("setClass", () => {
  it("accepts strings, records and nested arrays", () => {
    const el = document.createElement("div");
    setClass(el, ["a  b", { c: true, d: false }, [null, false, ["e"]]]);
    expect(el.className).toBe("a b c e");
  });

  it("diffs against what it applied, leaving other classes and scope tokens alone", () => {
    const el = document.createElement("div");
    el.setAttribute("data-l-x", "");
    el.classList.add("external");
    setClass(el, { a: true, b: true });
    expect(el.className).toBe("external a b");
    setClass(el, "b c");
    expect(el.className).toBe("external b c");
    setClass(el, null);
    expect(el.className).toBe("external");
    expect(el.hasAttribute("data-l-x")).toBe(true);
  });

  it("toggleClass toggles one class", () => {
    const el = document.createElement("div");
    toggleClass(el, "hot", 1);
    expect(el.classList.contains("hot")).toBe(true);
    toggleClass(el, "hot", 0);
    expect(el.classList.contains("hot")).toBe(false);
  });
});

describe("setStyle", () => {
  it("applies strings and kebab-case objects with custom properties", () => {
    const el = document.createElement("div");
    setStyle(el, "color: red");
    expect(el.style.color).toBe("red");
    setStyle(el, { "background-color": "blue", "--progress": 0.5 });
    expect(el.style.color).toBe("");
    expect(el.style.backgroundColor).toBe("blue");
    expect(el.style.getPropertyValue("--progress")).toBe("0.5");
  });

  it("diffs objects: only changed keys are written, missing and falsy keys removed", () => {
    const el = document.createElement("div");
    const writes: string[] = [];
    const setProperty = el.style.setProperty.bind(el.style);
    el.style.setProperty = (name: string, value: string | null) => {
      writes.push(name);
      setProperty(name, value);
    };
    setStyle(el, { color: "red", "font-size": "2px" });
    setStyle(el, { color: "red", "font-size": "3px", margin: false });
    expect(writes).toEqual(["color", "font-size", "font-size"]);
    expect(el.style.fontSize).toBe("3px");
    setStyle(el, { color: "red" });
    expect(el.style.fontSize).toBe("");
    setStyle(el, undefined);
    expect(el.style.color).toBe("");
  });

  it("setStyleProperty removes on nullish/false", () => {
    const el = document.createElement("div");
    setStyleProperty(el, "--x", "1px");
    expect(el.style.getPropertyValue("--x")).toBe("1px");
    setStyleProperty(el, "--x", false);
    expect(el.style.getPropertyValue("--x")).toBe("");
  });
});

describe("applyScope", () => {
  it("sets each scope token as an empty attribute", () => {
    const el = document.createElement("div");
    applyScope(el, "data-l-p1 data-l-p2");
    expect(el.getAttribute("data-l-p1")).toBe("");
    expect(el.getAttribute("data-l-p2")).toBe("");
    applyScope(el, undefined);
    expect(el.attributes.length).toBe(2);
  });
});

describe("setNonce", () => {
  it("gives a script or style the page's CSP nonce, keeping an explicit one (TASK-142)", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "csp-nonce");
    meta.nonce = "n0nce";
    document.head.appendChild(meta);
    const style = document.createElement("style");
    setNonce(style);
    expect(style.nonce).toBe("n0nce");
    const own = document.createElement("script");
    own.nonce = "own";
    setNonce(own);
    expect(own.nonce).toBe("own");
    meta.remove();
  });
});
