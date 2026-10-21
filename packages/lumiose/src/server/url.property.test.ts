// @vitest-environment happy-dom
// Unsafe URLs and escaping in rendered HTML (decision-29, TASK-168), as properties (decision-56,
// TASK-313): every value a browser would run as script or load as an HTML document is blocked in
// URL attributes, attribute values and text survive the HTML parser unchanged, and navigations
// only go to http(s) URLs.
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { describe, expect, it } from "vitest";
import { fc } from "../app/server/__fixtures__/property.ts";
import { navigationUrl } from "../app/actions/navigation.ts";
import { BLOCKED_URL, isUnsafeUrl, safeAttrValue } from "../dom/url.ts";
import { attr } from "./attrs.ts";
import { escapeText, rawText } from "./node.ts";

/** Whether a browser runs `value` as script, or loads it as an HTML document (the URL parser decides). */
function runsOrLoadsHtml(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false; // relative: resolved against the page, an http(s) URL
  }
  if (url.protocol === "javascript:" || url.protocol === "vbscript:") return true;
  if (url.protocol !== "data:") return false;
  // The data: URL processor: the MIME type before ",", without surrounding ASCII whitespace and
  // ";base64", up to its parameters.
  const comma = url.pathname.indexOf(",");
  if (comma < 0) return false;
  const mime = url.pathname
    .slice(0, comma)
    .replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "")
    .replace(/;[\t\n\f\r ]*base64$/i, "");
  return /^text\/html[\t\n\f\r ]*(?:;|$)/i.test(mime);
}

/** URL-like strings that try to hide a scheme or a data: MIME type. */
const urlLike = fc
  .tuple(
    fc
      .array(fc.constantFrom("\0", "\x01", "\x1f", " ", "\t", "\n", "\r", "\f"), { maxLength: 3 })
      .map((chars) => chars.join("")),
    fc.constantFrom("javascript", "vbscript", "data", "http", "blob", "jav"),
    fc.array(fc.nat(10), { maxLength: 2 }),
    fc.constantFrom("\t", "\n", "\r", " ", "\x0b", "\f"),
    fc.boolean(),
    fc.constantFrom(":", "%3A", "&#58;", ""),
    fc.constantFrom(
      "",
      "text/html",
      "TEXT/HTML",
      " text/html",
      "\ftext/html",
      "\x0btext/html",
      "text/html;charset=utf-8",
      "text/html;base64",
      "text/htmlx",
      "text%2Fhtml",
      "image/svg+xml",
      "text/plain",
    ),
    fc.constantFrom(",", ""),
    fc.string(),
  )
  .map(([prefix, scheme, cuts, noise, upper, colon, mime, comma, rest]) => {
    let name = upper ? scheme.toUpperCase() : scheme;
    for (const cut of cuts) name = name.slice(0, cut) + noise + name.slice(cut);
    return `${prefix}${name}${colon}${mime}${comma}${rest}`;
  });

const valueArb = fc.oneof(
  { arbitrary: urlLike, weight: 4 },
  fc.string(),
  fc.webUrl(),
  fc.string({ unit: "binary" }),
);

/** Text the HTML parser keeps as is: it turns NUL into U+FFFD and CR (LF) into LF. */
const htmlSafe = (value: string): boolean => !/[\0\r]/.test(value);

describe("unsafe URLs", () => {
  it("blocks every value a browser would run as script or load as HTML", () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        if (runsOrLoadsHtml(value)) expect(isUnsafeUrl(value)).toBe(true);
      }),
    );
  });

  it("renders blocked values as the placeholder on the server, as the client writes them", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("href", "src", "action", "formaction", "xlink:href", "title"),
        valueArb,
        (name, value) => {
          const html = attr(name, value);
          const blocked = name !== "title" && isUnsafeUrl(value);
          expect(safeAttrValue(name, value)).toBe(blocked ? BLOCKED_URL : value);
          expect(html.includes(BLOCKED_URL)).toBe(blocked || value.includes(BLOCKED_URL));
        },
      ),
    );
  });
});

// The escaping properties parse with parse5, which implements the HTML standard's tokenizer and tree
// construction as browsers do. happy-dom's parser is not a reference: it emits the text before a
// stray `-->` twice ("a-->" becomes "aa-->"), which failed the text property at 200,000 cases
// (TASK-344).
/** The only element `html` parses to, as the content of a `<template>`. */
function parseElement(html: string): DefaultTreeAdapterTypes.Element {
  const nodes = parseFragment(html).childNodes;
  expect(nodes).toHaveLength(1);
  return nodes[0] as DefaultTreeAdapterTypes.Element;
}

/** Asserts that escaped `value` parses back to the same text: no element or comment opens, no entity decodes. */
function textSurvives(value: string): void {
  const element = parseElement(`<p>${escapeText(value)}</p>`);
  const text = element.childNodes.map((node) => {
    expect(node.nodeName).toBe("#text");
    return (node as DefaultTreeAdapterTypes.TextNode).value;
  });
  expect(text.join("")).toBe(value);
}

describe("escaping", () => {
  it("keeps attribute values intact through the HTML parser, unsafe URLs aside", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("title", "href", "data-x", "alt", "aria-label"),
        valueArb.filter(htmlSafe),
        (name, value) => {
          const element = parseElement(`<a${attr(name, value)}></a>`);
          expect(element.attrs).toEqual([{ name, value: safeAttrValue(name, value) }]);
        },
      ),
    );
  });

  it("keeps text intact through the HTML parser: no tag or entity can open", () => {
    fc.assert(fc.property(valueArb.filter(htmlSafe), textSurvives));
  });

  it("keeps a stray comment end in text as text", () => {
    // The 200,000-case counterexample of happy-dom's parser (TASK-344).
    for (const value of ["javascript:,-->", "a-->", "--!>", "<!-- a -->"]) textSurvives(value);
  });
});

/** Text for `<script>` and `<style>`: openers of tags, end tags, comments and CDATA, entities, quotes. */
const rawArb = fc.oneof(
  fc
    .array(
      fc.constantFrom(
        "<",
        "</",
        "<!--",
        "<!",
        "<?",
        "<![CDATA[",
        "-->",
        "]]>",
        "img src=x onerror=alert(1)>",
        "script",
        "STYLE",
        "svg",
        "math",
        "b",
        "Z",
        "/",
        "!",
        "?",
        "&lt;",
        "&#60;",
        '"',
        "'",
        "`",
        "\\",
        " ",
        "\n",
        "a{}",
      ),
      { maxLength: 12 },
    )
    .map((parts) => parts.join("")),
  fc.string(),
  fc.string({ unit: "binary" }),
);

describe("raw text", () => {
  it("opens no tag, end tag or comment in script and style text, in HTML, SVG and MathML (TASK-495)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("script", "style"),
        fc.constantFrom("", "svg", "math"),
        rawArb,
        (tag, parent, value) => {
          const raw = rawText(value, tag);
          const inner = `<${tag}>${raw}</${tag}>`;
          let element = parseElement(parent === "" ? inner : `<${parent}>${inner}</${parent}>`);
          if (parent !== "") {
            expect(element.childNodes).toHaveLength(1);
            element = element.childNodes[0] as DefaultTreeAdapterTypes.Element;
            // A foreign element, whose text the parser reads as markup.
            expect(element.namespaceURI).not.toBe("http://www.w3.org/1999/xhtml");
          }
          expect(element.tagName).toBe(tag);
          for (const node of element.childNodes) expect(node.nodeName).toBe("#text");
          if (parent === "" && htmlSafe(value)) {
            const text = element.childNodes.map(
              (node) => (node as DefaultTreeAdapterTypes.TextNode).value,
            );
            expect(text.join("")).toBe(raw);
          }
        },
      ),
    );
  });

  it("keeps a JavaScript string the same in script text", () => {
    fc.assert(
      fc.property(rawArb, (value) => {
        const code = rawText(JSON.stringify(value), "script");
        expect(new Function(`return ${code}`)()).toBe(value);
      }),
    );
  });
});

describe("navigationUrl()", () => {
  it("navigates only to http(s) URLs, and refuses the rest with a TypeError", () => {
    fc.assert(
      fc.property(valueArb, (href) => {
        let url: URL | undefined;
        try {
          url = navigationUrl(href);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
        }
        if (url !== undefined) expect(["http:", "https:"]).toContain(url.protocol);
      }),
    );
  });
});
