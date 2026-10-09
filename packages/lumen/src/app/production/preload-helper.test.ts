// The build's preload helper (./client-runtime.ts) does not link a stylesheet again when the page
// already holds it in a merged file or an inline `<style>` (`data-l-css`, TASK-121).
import { Window } from "happy-dom";
import { afterEach, expect, it } from "vitest";
import { preloadHelper } from "./client-runtime.ts";

type Preload = (load: () => unknown, deps: string[], importer?: string) => Promise<unknown>;

const window = new Window({ url: "https://example.com/" });
const document = window.document;
// oxlint-disable-next-line typescript/no-implied-eval -- runs the generated helper's source
const helper = new Function(
  "document",
  "location",
  preloadHelper("/").replace("export const __vitePreload =", "return"),
)(document, window.location) as Preload;

afterEach(() => {
  document.head.innerHTML = "";
});

it("skips stylesheets that a merged file or an inline style already holds", () => {
  document.head.innerHTML =
    '<link rel="stylesheet" href="/assets/styles-x.css" data-l-css="/assets/a.css /assets/b.css">' +
    '<style data-l-css="/assets/c.css">.c{}</style>';
  void helper(() => undefined, ["assets/a.css", "assets/c.css", "assets/d.css", "assets/e.js"]);
  const added = [...document.head.querySelectorAll("link")].slice(1);
  expect(added.map((link) => [link.rel, link.getAttribute("href")])).toEqual([
    ["stylesheet", "https://example.com/assets/d.css"],
    ["modulepreload", "https://example.com/assets/e.js"],
  ]);
});
