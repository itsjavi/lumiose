// The `?client` custom elements of the docs run in a DOM (TASK-517). A `?client` script is an
// async module script, so it can define its element before the parser reaches it: each element
// then connects before its children, which the parser appends while the document is still
// loading. Each example runs that way, with the definition loaded before the body, and the usual
// way, after it.
import { Window, type Document, type Element, type Node } from "happy-dom";
import { transformWithOxc } from "vite";
import { describe, expect, it, vi } from "vitest";
import { loadProjectDocs } from "./index.ts";

const docs = loadProjectDocs({});

/** The ```ts check file=<file> block of a doc. */
function example(topic: string, file: string): string {
  const doc = docs.find((candidate) => candidate.topic === topic);
  const fence = new RegExp(String.raw`^\`\`\`ts check file=${file}\n([\s\S]*?)^\`\`\`$`, "m");
  const code = doc?.content.match(fence)?.[1];
  if (code === undefined)
    throw new Error(`docs/${topic}.md has no \`ts check file=${file}\` block`);
  return code;
}

/** Inserts `html` as the parser does: each element connects before its children. */
function parse(document: Document, html: string, parent: Node): void {
  const template = document.createElement("template");
  template.innerHTML = html;
  const append = (nodes: Iterable<Node>, into: Node): void => {
    for (const node of nodes) {
      if (node.nodeType !== node.ELEMENT_NODE) {
        into.appendChild(node.cloneNode());
        continue;
      }
      const source = node as Element;
      const element = document.createElement(source.localName);
      for (const { name, value } of source.attributes) element.setAttribute(name, value ?? "");
      into.appendChild(element);
      append(source.childNodes, element);
    }
  };
  append(template.content.childNodes, parent);
}

/** A page whose body is `html`, with the script defined before or after the parser reaches it. */
async function page(script: string, html: string, defined: "before body" | "after body") {
  const window = new Window({ url: "https://example.test/" });
  const { document } = window;
  let readyState: DocumentReadyState = "loading";
  Object.defineProperty(document, "readyState", { configurable: true, get: () => readyState });
  const writeText = vi.fn(async (_text: string) => {});
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const { code } = await transformWithOxc(script, "script.ts");

  if (defined === "before body") {
    window.eval(code);
    parse(document, html, document.body);
  } else {
    parse(document, html, document.body);
    readyState = "interactive";
    window.eval(code);
  }
  readyState = "interactive";
  document.dispatchEvent(new window.Event("DOMContentLoaded"));
  return { window, document, writeText };
}

const WHEN = ["before body", "after body"] as const;

describe("docs custom elements", () => {
  it.each(WHEN)("local-time replaces the server's text, defined %s", async (defined) => {
    const datetime = "2026-10-21T08:00:00.000Z";
    const { window, document } = await page(
      example("guides/web-components", "elements/local-time.ts"),
      `<local-time datetime="${datetime}" format="date">2026-10-21</local-time>`,
      defined,
    );
    const formatted = new window.Date(datetime).toLocaleString(undefined, { dateStyle: "medium" });
    expect(document.querySelector("local-time")!.textContent).toBe(formatted);
    await window.happyDOM.close();
  });

  it.each(WHEN)("copy-button copies its attribute, defined %s", async (defined) => {
    const { window, document, writeText } = await page(
      example("concepts/islands", "components/copy-button.ts"),
      `<copy-button text="pnpm add lumiose"><button type="button">Copy</button></copy-button>`,
      defined,
    );
    document.querySelector("button")!.click();
    expect(writeText.mock.calls).toEqual([["pnpm add lumiose"]]);
    await window.happyDOM.close();
  });

  it.each(WHEN)("copy-code adds one button that copies the code, defined %s", async (defined) => {
    const { window, document, writeText } = await page(
      example("guides/web-components", "elements/copy-code.ts"),
      `<copy-code class="code-block"><pre><code>let total = 0;</code></pre></copy-code>`,
      defined,
    );
    const element = document.querySelector("copy-code")!;
    document.body.appendChild(element); // a move connects it again
    expect(element.querySelectorAll("button")).toHaveLength(1);
    expect(element.firstElementChild!.localName).toBe("button");
    element.querySelector("button")!.click();
    expect(writeText.mock.calls).toEqual([["let total = 0;"]]);
    await window.happyDOM.close();
  });
});
