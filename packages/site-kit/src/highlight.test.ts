import { describe, expect, test } from "vitest";
import { escapeHtml, highlight } from "./highlight.ts";

/** `[kind:text]` for each token, so expectations stay readable. */
const tokens = (code: string, lang: string) =>
  highlight(code, lang).replace(/<span class="tok-(\w+)">([^<]*)<\/span>/g, "[$1:$2]");

describe("highlight", () => {
  test("escapes code it does not mark up", () => {
    expect(highlight("<b> & co", "text")).toBe("&lt;b&gt; &amp; co");
    expect(escapeHtml(`"<'>"`)).toBe("&quot;&lt;'&gt;&quot;");
    const html = highlight('const a = "<script>";', "ts");
    expect(html).not.toContain("<script>");
  });

  test("reads TSX: keywords, JSX tags, attributes and expressions", () => {
    expect(tokens('return <Card href="/docs">{count()}</Card>;', "tsx")).toBe(
      "[keyword:return] [punct:&lt;][type:Card] [attr:href][punct:=][string:&quot;/docs&quot;]" +
        "[punct:&gt;][punct:{][fn:count][punct:(][punct:)][punct:}][punct:&lt;/][type:Card][punct:&gt;][punct:;]",
    );
  });

  test("tells comparisons and type arguments from JSX", () => {
    expect(tokens("a < b", "ts")).toBe("a [punct:&lt;] b");
    expect(tokens("signal<number>(0)", "ts")).toBe(
      "signal[punct:&lt;]number[punct:&gt;][punct:(][number:0][punct:)]",
    );
  });

  test("highlights .stsx style blocks as CSS, $ references included", () => {
    const html = tokens(
      "<div>\n  <style>\n    .a { gap: $space.md; }\n    @media (width < $bp.md) { .a:hover { color: red; } }\n  </style>\n</div>",
      "stsx",
    );
    expect(html).toContain("[prop:gap][punct::] [ref:$space.md]");
    expect(html).toContain("[keyword:@media] [punct:(]width [punct:&lt;] [ref:$bp.md]");
    expect(html).toContain("[tag:a][punct::][tag:hover]");
    expect(html).toContain("[punct:&lt;/][tag:style][punct:&gt;]");
  });

  test("highlights a top-level style block after a component", () => {
    expect(tokens("}\n\n<style global>\n  body { margin: 0 }\n</style>", "stsx")).toContain(
      "[punct:&lt;][tag:style] [attr:global][punct:&gt;]\n  [tag:body] [punct:{] [prop:margin]",
    );
  });

  test("reads shell commands", () => {
    expect(tokens("$ pnpm add lumiose && npx lumiose check --root . # done", "sh")).toBe(
      "[punct:$] [fn:pnpm] add lumiose [punct:&amp;&amp;] [fn:npx] lumiose check [attr:--root] . [comment:# done]",
    );
  });
});
