// The dev annotation of HTML pages (TASK-148, ./annotation.ts): what may change while a page is
// patched in place, and what reloads it.
import { describe, expect, it } from "vitest";
import { devAnnotation, fingerprint, slotHtml } from "./annotation.ts";

const doc = (body: string, head = "", html = ' lang="en"') =>
  `<!doctype html><html${html}><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const records = (...entries: object[]) =>
  `<script type="application/json" data-l-islands>${JSON.stringify(entries)}</script>`;
const payload = (value: number) =>
  `<script type="application/json" data-l-payload>{"s":{"/src/s.ts#s":{"v":${value}}}}</script>`;
/** A page with an island whose own render is `own` and whose children slot is `slot`. */
const page = (own: string, slot: string) =>
  doc(`<!--l:0--><div>${own}<!--l:s:children--><p>${slot}</p><!--/l:s--></div><!--/l:0-->`);
const island = { id: 0, ref: "/src/C.stsx#C", strategy: "load", props: { n: 1 } };

describe("the dev annotation", () => {
  it("describes the page in a JSON script", () => {
    const tag = devAnnotation(doc("<p>x</p>"), { method: "GET", status: 200, errors: false });
    const json = /^<script type="application\/json" data-l-dev>(.*)<\/script>$/.exec(tag)![1]!;
    expect(JSON.parse(json)).toEqual({
      method: "GET",
      status: 200,
      errors: false,
      shell: expect.any(String),
      islands: expect.any(String),
    });
  });

  it("fingerprints the document's start tags and scripts, not its content or nonces", () => {
    const base = fingerprint(
      doc("<p>x</p>", '<script type="module" src="/a.ts" nonce="1"></script>'),
    );
    expect(
      fingerprint(doc("<main>y</main>", '<script type="module" src="/a.ts" nonce="2"></script>')),
    ).toEqual(base);
    // JSON data and streaming's swaps are not scripts.
    const data = '<script type="application/ld+json">{}</script><script>$swap("lb0")</script>';
    expect(
      fingerprint(doc(`<p>x</p>${data}`, '<script type="module" src="/a.ts"></script>')).shell,
    ).toBe(base.shell);
    for (const changed of [
      doc("<p>x</p>", '<script type="module" src="/b.ts"></script>'),
      doc("<p>x</p><script>go()</script>", '<script type="module" src="/a.ts"></script>'),
      doc("<p>x</p>", '<script type="module" src="/a.ts"></script>', ' lang="es"'),
      doc("<p>x</p>", '<script type="module" src="/a.ts"></script>').replace(
        "<body>",
        '<body class="dark">',
      ),
    ]) {
      expect(fingerprint(changed).shell).not.toBe(base.shell);
    }
  });

  it("fingerprints island records without their awaits, in id order, and the payload", () => {
    const other = { ...island, id: 1, ref: "/src/D.stsx#D" };
    const base = fingerprint(doc(records(island, other))).islands;
    expect(
      fingerprint(doc(records(other) + records({ ...island, awaits: { a: 1 } }))).islands,
    ).toBe(base);
    expect(
      fingerprint(doc(records(island, other) + records({ id: 0, awaits: { b: 2 } }))).islands,
    ).toBe(base);
    expect(fingerprint(doc(records({ ...island, props: { n: 2 } }, other))).islands).not.toBe(base);
    const withPayload = fingerprint(doc(payload(1) + records(island))).islands;
    expect(fingerprint(doc(payload(2) + records(island))).islands).not.toBe(withPayload);
  });

  it("fingerprints the slot HTML of islands, not their own render", () => {
    const base = fingerprint(page("own", "slot")).islands;
    expect(fingerprint(page("edited", "slot")).islands).toBe(base);
    expect(fingerprint(page("own", "changed")).islands).not.toBe(base);
  });
});

describe("slotHtml", () => {
  it("keeps slot templates and inline slots, outermost first, without nonces", () => {
    const range =
      '<template data-l-slot="icon"><i>x</i><template><b>inner</b></template></template>' +
      "<div><!--l:s:children--><p>a</p><!--l:s:nested--><em>b</em><!--/l:s--><!--/l:s--></div>" +
      '<template><u>own</u></template><style nonce="abc">p{}</style>';
    expect(slotHtml(range)).toBe(
      '<template data-l-slot="icon"><i>x</i><template><b>inner</b></template></template>' +
        "<!--l:s:children--><p>a</p><!--l:s:nested--><em>b</em><!--/l:s--><!--/l:s-->",
    );
    expect(slotHtml('<button>1</button><template><style nonce="x"></style></template>')).toBe("");
    expect(slotHtml('<!--l:s:c--><style nonce="x"></style><!--/l:s-->')).toBe(
      "<!--l:s:c--><style></style><!--/l:s-->",
    );
  });
});
