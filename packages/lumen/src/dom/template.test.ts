// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { TemplateFlags } from "../contract/client.ts";
import { template } from "./index.ts";

describe("template", () => {
  it("clones a fresh copy of the root on every call", () => {
    const t = template(`<div class=a><span>hi</span></div>`);
    const a = t();
    const b = t();
    expect(a).not.toBe(b);
    expect(a.outerHTML).toBe(`<div class="a"><span>hi</span></div>`);
    expect(b.outerHTML).toBe(a.outerHTML);
    a.firstChild!.textContent = "changed";
    expect(t().textContent).toBe("hi");
  });

  it("parses minified HTML with omitted closing tags and <!> placeholders", () => {
    const t = template(`<button data-l-c1>Clicked <!> times`);
    const el = t();
    expect(el.tagName).toBe("BUTTON");
    expect(el.hasAttribute("data-l-c1")).toBe(true);
    const [text, marker, rest] = Array.from(el.childNodes);
    expect(text!.nodeValue).toBe("Clicked ");
    expect(marker!.nodeType).toBe(Node.COMMENT_NODE);
    expect(rest!.nodeValue).toBe(" times");
  });

  it("parses table fragments (rows) as roots", () => {
    const t = template(`<tr data-l-x><td data-l-x><a data-l-x> `);
    const tr = t();
    expect(tr.tagName).toBe("TR");
    expect(tr.firstChild!.firstChild!.nodeName).toBe("A");
    expect(tr.firstChild!.firstChild!.firstChild!.nodeValue).toBe(" ");
  });

  it("returns every root with MultiRoot", () => {
    const t = template(`<h1>a</h1>text<p>b`, TemplateFlags.MultiRoot) as () => Node[];
    const nodes = t();
    expect(nodes.map((n) => n.nodeName)).toEqual(["H1", "#text", "P"]);
    expect(t()[0]).not.toBe(nodes[0]);
  });

  it("parses in the SVG and MathML namespaces", () => {
    const g = template(`<g><circle r=1></circle></g>`, TemplateFlags.Svg)() as Element;
    expect(g.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(g.firstElementChild!.namespaceURI).toBe("http://www.w3.org/2000/svg");
    const roots = (
      template(
        `<path></path><rect></rect>`,
        TemplateFlags.Svg | TemplateFlags.MultiRoot,
      ) as () => Node[]
    )();
    expect(roots.map((n) => (n as Element).namespaceURI)).toEqual([
      "http://www.w3.org/2000/svg",
      "http://www.w3.org/2000/svg",
    ]);
    // happy-dom parses <math> content in the HTML namespace; browsers use MathML. Check the unwrap.
    const mi = template(`<mi>x</mi>`, TemplateFlags.MathMl)() as Element;
    expect(mi.nodeName.toLowerCase()).toBe("mi");
    expect(mi.parentNode).toBeNull();
  });
});
