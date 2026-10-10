// @vitest-environment happy-dom
// The `$swap` fallback in a DOM: `<?start>`/`<?end>` processing instructions parse as comments in
// browsers without declarative partial updates.
import { beforeAll, describe, expect, it } from "vitest";
import { SWAP_SCRIPT } from "./render.ts";

declare const $swap: (name: string) => void;

function range(name: string, nodes: Node[]): Node[] {
  return [
    document.createComment(`?start name="${name}"`),
    ...nodes,
    document.createComment("?end"),
  ];
}

function template(name: string, html: string): HTMLTemplateElement {
  const element = document.createElement("template");
  element.setAttribute("for", name);
  element.innerHTML = html;
  return element;
}

describe("$swap", () => {
  beforeAll(() => {
    // Indirect eval: a classic script that defines the global, as in the page.
    // oxlint-disable-next-line no-eval -- runs the inline script exactly as the page does
    (0, eval)(SWAP_SCRIPT);
  });

  it("replaces the fallback range with the template content", () => {
    document.body.innerHTML = "<main><h1>shell</h1></main>";
    const main = document.querySelector("main")!;
    main.append(
      ...range("lb0", [document.createTextNode("loading")]),
      document.createElement("footer"),
    );
    document.body.append(template("lb0", "<p>done</p><p>two</p>"));
    $swap("lb0");
    expect(document.body.innerHTML).toBe(
      "<main><h1>shell</h1><p>done</p><p>two</p><footer></footer></main>",
    );
  });

  it("matches nested ranges and leaves later boundaries in place", () => {
    document.body.innerHTML = "<main></main>";
    const main = document.querySelector("main")!;
    main.append(
      ...range("lb1", [
        document.createTextNode("a"),
        ...range("lb2", [document.createTextNode("b")]),
      ]),
      ...range("lb3", [document.createTextNode("c")]),
    );
    document.body.append(template("lb1", "<p>outer</p>"));
    $swap("lb1");
    expect(main.innerHTML).toBe('<p>outer</p><!--?start name="lb3"-->c<!--?end-->');
    expect(document.querySelector("template")).toBeNull();
  });

  it("does nothing when the template was already applied natively", () => {
    document.body.innerHTML = "<p>x</p>";
    $swap("lb9");
    expect(document.body.innerHTML).toBe("<p>x</p>");
  });
});
