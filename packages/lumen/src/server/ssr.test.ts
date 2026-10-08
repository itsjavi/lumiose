// Server helpers and the doc-2 golden examples, hand-compiled as the compiler will emit them.
import { describe, expect, it } from "vitest";
import { signal } from "../core/server.ts";
import {
  $await,
  $leave,
  attr,
  branch,
  classAttr,
  createComponent,
  escape,
  insert,
  list,
  mergeProps,
  renderToString,
  restProps,
  selector,
  spreadAttrs,
  ssr,
  styleAttr,
  text,
} from "./index.ts";

type Props = any;

/** Renders a root thunk fully resolved. */
const render = (root: () => unknown) => renderToString(root);
const html = (node: unknown) => (node as { t: string }).t;

function Card(props: Props) {
  return ssr(
    ["<article", "", "><h2>", "</h2>", "</article>"],
    classAttr(props.class),
    spreadAttrs({ $$scope: props.$$scope }),
    text(props.title),
    insert(props.children),
  );
}

const fetchJSON = async (url: string) => ({ name: `member ${url.split("/").pop()}` });

async function Member(props: Props) {
  try {
    const m = (await $await(() => fetchJSON(`/api/members/${props.id}`), 0))();
    return ssr(["<h3>", "</h3>"], text(m.name));
  } finally {
    $leave();
  }
}

describe("escaping", () => {
  it("escapes text and attribute contexts", () => {
    expect(escape(`<a href="x">&</a>`)).toBe(`&lt;a href="x"&gt;&amp;&lt;/a&gt;`);
    expect(escape(`"a" & <b>`, true)).toBe("&quot;a&quot; &amp; &lt;b&gt;");
    expect(escape(null)).toBe("");
    expect(escape(false)).toBe("");
    expect(escape(42)).toBe("42");
  });

  it("escapes strings in content positions and keeps rendered nodes raw", async () => {
    const out = await render(() =>
      ssr(["<p>", "", "</p>"], insert("<script>x</script>"), insert(ssr(["<b>ok</b>"]))),
    );
    expect(out).toBe("<p>&lt;script&gt;x&lt;/script&gt;<b>ok</b></p>");
  });

  it("never treats user objects shaped like nodes as HTML", async () => {
    const row = { t: "<img src=x onerror=alert(1)>" };
    expect(await render(() => ssr(["<p>", "</p>"], insert(row)))).toBe("<p>[object Object]</p>");
  });

  it("renders nullish, booleans, numbers, arrays and getters in content", async () => {
    const out = await render(() =>
      ssr(["<p>", "</p>"], insert([null, undefined, true, false, 0, 1n, ["a", () => "<b>"]])),
    );
    expect(out).toBe("<p>01a&lt;b&gt;</p>");
  });
});

describe("attributes", () => {
  it("serializes single attributes", () => {
    expect(attr("title", `a "quote" & <tag>`)).toBe(
      ' title="a &quot;quote&quot; &amp; &lt;tag&gt;"',
    );
    expect(attr("disabled", true)).toBe(" disabled");
    expect(attr("disabled", false)).toBe("");
    expect(attr("title", null)).toBe("");
    expect(attr("tabindex", 0)).toBe(' tabindex="0"');
    expect(attr("onclick", () => {})).toBe("");
  });

  it("writes aria-* and enumerated attributes as true/false, like the client setAttr", () => {
    expect(attr("aria-hidden", true)).toBe(' aria-hidden="true"');
    expect(attr("aria-expanded", false)).toBe(' aria-expanded="false"');
    expect(attr("draggable", false)).toBe(' draggable="false"');
    expect(attr("spellcheck", true)).toBe(' spellcheck="true"');
    expect(attr("contenteditable", false)).toBe(' contenteditable="false"');
    expect(attr("aria-label", null)).toBe("");
    // translate takes yes/no, so it stays a plain attribute (as on the client).
    expect(attr("translate", false)).toBe("");
    expect(attr("hidden", false)).toBe("");
  });

  it("combines class strings, arrays and objects", () => {
    expect(classAttr("a b")).toBe(' class="a b"');
    expect(classAttr(["a", { b: true, c: false }, ["d", null]])).toBe(' class="a b d"');
    expect(classAttr({ hot: false })).toBe("");
    expect(classAttr(undefined)).toBe("");
  });

  it("serializes style strings and objects with custom properties", () => {
    expect(styleAttr("color: red")).toBe(' style="color: red"');
    expect(styleAttr({ color: "red", "--size": 2, margin: null, hidden: false })).toBe(
      ' style="color:red;--size:2"',
    );
    expect(styleAttr({})).toBe("");
  });

  it("spreads props, skipping handlers, directives, content and unsafe names", () => {
    expect(
      spreadAttrs({
        id: "x",
        class: ["a", { b: true }],
        style: { color: "red" },
        onClick: () => {},
        "on:scroll": () => {},
        "bind:value": signal(""),
        children: "c",
        ref: () => {},
        hidden: true,
        "aria-busy": false,
        indeterminate: true,
        "xlink:href": "#icon",
        title: undefined,
        'x" onload="alert(1)': "y",
        $$scope: "data-l-p1",
      }),
    ).toBe(
      ' id="x" class="a b" style="color:red" hidden aria-busy="false" xlink:href="#icon" data-l-p1',
    );
  });
});

describe("golden examples (contract doc-2 §5)", () => {
  it("5.1 counter: static and dynamic text, class object", async () => {
    const s0 = ["<button data-l-c1", ">Clicked ", " times</button>"];
    function Counter(props: Props) {
      const count = signal(props.start === undefined ? 0 : props.start);
      return ssr(s0, classAttr({ hot: count() > 5 }), insert(count()));
    }
    expect(await render(() => createComponent(Counter, {}))).toBe(
      "<button data-l-c1>Clicked 0 times</button>",
    );
    expect(await render(() => createComponent(Counter, { start: 7 }))).toBe(
      '<button data-l-c1 class="hot">Clicked 7 times</button>',
    );
  });

  it("5.2 keyed list with a selector", async () => {
    const rows = signal([
      { id: 1, label: signal("one") },
      { id: 2, label: signal("two <b>") },
    ]);
    const selected = signal(2);
    const s1 = ["<tr data-l-x", "><td data-l-x><a data-l-x>", "</a></td></tr>"];
    function Table() {
      const isSelected = selector(selected);
      return ssr(
        ["<table><tbody>", "</tbody></table>"],
        list(rows(), (row) =>
          ssr(s1, classAttr({ danger: isSelected(row.id) }), text(row.label())),
        ),
      );
    }
    expect(await render(() => createComponent(Table, {}))).toBe(
      "<table><tbody>" +
        "<tr data-l-x><td data-l-x><a data-l-x>one</a></td></tr>" +
        '<tr data-l-x class="danger"><td data-l-x><a data-l-x>two &lt;b&gt;</a></td></tr>' +
        "</tbody></table>",
    );
  });

  it("5.3 component call with getter props, children and class passthrough", async () => {
    const post = signal({ title: "Hello", body: "<i>body</i>" });
    const out = await render(() =>
      ssr(
        ["<main>", "</main>"],
        insert(
          createComponent(Card, {
            get title() {
              return post().title;
            },
            class: "featured",
            $$scope: "data-l-p1",
            get children() {
              return post().body;
            },
          }),
        ),
      ),
    );
    expect(out).toBe(
      '<main><article class="featured" data-l-p1><h2>Hello</h2>&lt;i&gt;body&lt;/i&gt;</article></main>',
    );
  });

  it("5.4 async component", async () => {
    expect(await render(() => createComponent(Member, { id: "7" }))).toBe("<h3>member 7</h3>");
  });
});

describe("ssr", () => {
  it("is sync without thenable holes", () => {
    const node = ssr(["<p>", "</p>"], text("a"));
    expect(node).not.toBeInstanceOf(Promise);
    expect(html(node)).toBe("<p>a</p>");
  });

  it("resolves async holes concurrently and keeps their order", async () => {
    const started: string[] = [];
    const delay = (name: string, ms: number) => {
      started.push(name);
      return new Promise<unknown>((resolve) => setTimeout(() => resolve(ssr([name])), ms));
    };
    const node = ssr(["<a>", "|", "|", "</a>"], delay("slow", 20), text("sync"), delay("fast", 1));
    expect(node).toBeInstanceOf(Promise);
    expect(started).toEqual(["slow", "fast"]);
    expect(html(await node)).toBe("<a>slow|sync|fast</a>");
  });

  it("rejects with the first rejection", async () => {
    const boom = new Error("boom");
    await expect(
      Promise.resolve(ssr(["", "", ""], Promise.reject(boom), Promise.resolve(ssr(["x"])))),
    ).rejects.toBe(boom);
  });
});

describe("list, branch and props helpers outside islands", () => {
  it("renders lists with an index getter and nothing for empty sources", async () => {
    expect(
      await render(() =>
        list(["a", "b"], (item, index) => ssr(["<i>", "</i>"], text(`${index()}${item}`))),
      ),
    ).toBe("<i>0a</i><i>1b</i>");
    expect(await render(() => list(null, () => "x"))).toBe("");
  });

  it("renders one branch without markers", async () => {
    expect(
      await render(() =>
        branch(
          () => true,
          () => ssr(["yes"]),
          () => ssr(["no"]),
        ),
      ),
    ).toBe("yes");
    expect(
      await render(() =>
        branch(
          0,
          () => ssr(["yes"]),
          () => ssr(["no"]),
        ),
      ),
    ).toBe("no");
    expect(await render(() => branch(false, () => ssr(["yes"])))).toBe("");
  });

  it("restProps and mergeProps keep getters lazy", () => {
    let reads = 0;
    const props = {
      a: 1,
      get children() {
        reads++;
        return "c";
      },
    };
    const rest = restProps(props, ["a"]);
    expect(Object.keys(rest)).toEqual(["children"]);
    expect(reads).toBe(0);
    expect(rest.children).toBe("c");

    const merged = mergeProps({ a: 1, b: 2 } as Record<string, unknown>, props, { b: undefined });
    expect(reads).toBe(1);
    expect(merged.a).toBe(1);
    expect(merged.b).toBeUndefined();
    expect(merged.children).toBe("c");
    expect(reads).toBe(2);
  });
});
