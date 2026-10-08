// Island markers, slots, records and await records (decision-9, spec §7.2, §7.4).
import { describe, expect, it } from "vitest";
import { signal } from "../core/server.ts";
import { Suspense } from "./components.ts";
import {
  $await,
  $leave,
  branch,
  classAttr,
  createComponent,
  insert,
  island,
  list,
  renderToStream,
  ssr,
  text,
} from "./index.ts";
import { decodeData } from "./serialize.ts";

type Props = any;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function Counter(props: Props) {
  const count = signal(props.start ?? 0);
  return ssr(
    ["<button", ">Clicked ", " times</button>"],
    classAttr({ hot: count() > 5 }),
    insert(count()),
  );
}

/** The `data-l-islands` records in some HTML, decoded. */
function records(html: string): any[] {
  const all: any[] = [];
  for (const match of html.matchAll(
    /<script type="application\/json" data-l-islands>(.*?)<\/script>/g,
  )) {
    all.push(...(JSON.parse(match[1]!) as any[]));
  }
  return all;
}

function TeamPanel(props: Props) {
  return ssr(["<section>", "", "</section>"], text(props.ids.join(",")), insert(props.children));
}

function Outer() {
  return ssr(
    ["<div>", "</div>"],
    island("/src/Counter.stsx#Counter", Counter, { start: 2 }, "idle"),
  );
}

function View(props: Props) {
  return ssr(
    ["<p>", "", "</p><ul>", "</ul>", ""],
    text(props.a),
    text(props.b),
    list(props.items, (item: string) => ssr(["<li>", "</li>"], text(item))),
    branch(
      props.open,
      () => ssr(["<b>open</b>"]),
      () => ssr(["<i>closed</i>"]),
    ),
  );
}

async function Member(props: Props) {
  try {
    const member = (
      await $await(() => sleep(1).then(() => ({ name: props.name, since: new Date(0) })), 0)
    )();
    let out = "";
    for (const id of [1, 2]) {
      out += (await $await(() => Promise.resolve(`#${id}`), 1))();
    }
    return ssr(["<h3>", "", "</h3>"], text(member.name), text(out));
  } finally {
    $leave();
  }
}

async function Raw() {
  try {
    const res = (await $await(() => new Response("{}"), 0))();
    return ssr([String(res.ok)]);
  } finally {
    $leave();
  }
}

async function Late(props: Props) {
  try {
    const value = (await $await(() => sleep(2).then(() => props.value), 0))();
    return ssr(["<p>", "</p>"], text(value));
  } finally {
    $leave();
  }
}

function Team() {
  return ssr(
    ["<div>", "", "</div>"],
    createComponent(Member, { name: "ada" }),
    createComponent(Member, { name: "bob" }),
  );
}

function Panel() {
  return ssr(
    ["<aside>", "</aside>"],
    createComponent(Suspense, {
      get fallback() {
        return ssr(["…"]);
      },
      get children() {
        return createComponent(Late, { value: "inner" });
      },
    }),
  );
}

describe("island()", () => {
  it("wraps the island in markers, adds hydration markers and queues its record", async () => {
    const shell = await renderToStream(() =>
      ssr(
        ["<main>", "</main>"],
        island("/src/Counter.stsx#Counter", Counter, { start: 1 }, "load"),
      ),
    );
    expect(shell.body).toBe(
      "<main><!--l:0--><button>Clicked <!--[-->1<!--]--> times</button><!--/l:0--></main>" +
        '<script type="application/json" data-l-islands>' +
        '[{"id":0,"ref":"/src/Counter.stsx#Counter","strategy":"load","props":{"start":1}}]</script>',
    );
    expect(shell.head).toBe('<link rel="modulepreload" href="/src/Counter.stsx">');
  });

  it("maps modulepreload URLs and only preloads client:load islands", async () => {
    const shell = await renderToStream(
      () =>
        ssr(
          ["", "", "", ""],
          island("/src/Counter.stsx#Counter", Counter, {}, "load"),
          island("/src/Counter.stsx#Counter", Counter, {}, "load"),
          island("/src/Other.stsx#Other", Counter, {}, "idle"),
        ),
      { islandUrl: (specifier) => `/assets${specifier.replace(".stsx", "-abc.js")}` },
    );
    expect(shell.head).toBe('<link rel="modulepreload" href="/assets/src/Counter-abc.js">');
    expect(records(shell.body).map((record) => record.id)).toEqual([0, 1, 2]);
  });

  it("renders slots into templates and inline (golden 5.5), with the strategy value", async () => {
    const shell = await renderToStream(() =>
      island(
        "/src/components/Team.stsx#TeamPanel",
        TeamPanel,
        { ids: [1, 2] },
        "visible",
        "200px",
        {
          children: () => ssr(["<p>footer</p>"]),
        },
      ),
    );
    expect(shell.body.split("<script")[0]).toBe(
      '<!--l:0--><template data-l-slot="children"><p>footer</p></template>' +
        "<section>1,2<!--[--><p>footer</p><!--]--></section><!--/l:0-->",
    );
    expect(records(shell.body)).toEqual([
      {
        id: 0,
        ref: "/src/components/Team.stsx#TeamPanel",
        strategy: "visible",
        value: "200px",
        props: { ids: [1, 2] },
        slots: ["children"],
      },
    ]);
  });

  it("renders only the slots for client:only", async () => {
    const shell = await renderToStream(() =>
      island("/src/Map.stsx#Map", () => ssr(["never"]), { zoom: 3 }, "only", undefined, {
        children: () => ssr(["<p>static</p>"]),
      }),
    );
    expect(shell.body.split("<script")[0]).toBe(
      '<!--l:0--><template data-l-slot="children"><p>static</p></template><!--/l:0-->',
    );
  });

  it("renders islands inside an island inline, without a record", async () => {
    const shell = await renderToStream(() => island("/src/Outer.stsx#Outer", Outer, {}, "idle"));
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><div><button>Clicked <!--[-->2<!--]--> times</button></div><!--/l:0-->",
    );
    expect(records(shell.body)).toHaveLength(1);
  });

  it("separates adjacent text holes and marks lists and branches only inside islands", async () => {
    const props = { a: "x", b: "y", items: ["1", "2"], open: false };
    const inside = await renderToStream(() => island("/src/View.stsx#View", View, props, "idle"));
    expect(inside.body.split("<script")[0]).toBe(
      "<!--l:0--><p>x<!--!-->y</p><ul><!--[--><li>1</li><li>2</li><!--]--></ul>" +
        "<!--[!--><i>closed</i><!--]--><!--/l:0-->",
    );
    const outside = await renderToStream(() => createComponent(View, { ...props, open: true }));
    expect(outside.body).toBe("<p>xy</p><ul><li>1</li><li>2</li></ul><b>open</b>");
  });

  it("serializes rich data with tags and rejects non-data props with LUM4002 and a path", async () => {
    const props = {
      when: new Date("2026-10-08T00:00:00.000Z"),
      tags: new Set(["a"]),
      big: 10n,
      skip: undefined,
    };
    const shell = await renderToStream(() => island("/src/X.stsx#X", Counter, props, "idle"));
    const [record] = records(shell.body);
    expect(decodeData(record.props)).toEqual({
      when: props.when,
      tags: props.tags,
      big: 10n,
    });

    const failing = renderToStream(() =>
      island("/src/X.stsx#Panel", Counter, { user: { name: "a", save() {} } }, "visible"),
    );
    await expect(failing).rejects.toMatchObject({ code: "LUM4002" });
    await expect(failing).rejects.toThrow(
      /Island prop "user.save" of <Panel client:visible> \(\/src\/X.stsx#Panel\) is a function/,
    );
  });
});

describe("await records", () => {
  it("records awaited values under instancePath:site:occurrence", async () => {
    const shell = await renderToStream(() => island("/src/Team.stsx#Team", Team, {}, "idle"));
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><div><h3>ada<!--!-->#1#2</h3><h3>bob<!--!-->#1#2</h3></div><!--/l:0-->",
    );
    const [record] = records(shell.body);
    expect(Object.keys(record.awaits).toSorted()).toEqual([
      "0.0:0:0",
      "0.0:1:0",
      "0.0:1:1",
      "0.1:0:0",
      "0.1:1:0",
      "0.1:1:1",
    ]);
    expect(decodeData(record.awaits["0.1:0:0"])).toEqual({ name: "bob", since: new Date(0) });
    expect(record.awaits["0.0:1:1"]).toBe("#2");
  });

  it("does not record awaits outside islands", async () => {
    const shell = await renderToStream(() => createComponent(Team, {}));
    expect(shell.body).toBe("<div><h3>ada#1#2</h3><h3>bob#1#2</h3></div>");
  });

  it("rejects non-data awaited values inside islands with LUM4007", async () => {
    const failing = renderToStream(() => island("/src/Raw.stsx#Raw", Raw, {}, "load"));
    await expect(failing).rejects.toMatchObject({ code: "LUM4007" });
    await expect(failing).rejects.toThrow(
      /awaited at 0:0:0 in island \/src\/Raw.stsx#Raw is an instance of Response/,
    );
  });

  it("sends records of islands in a boundary, and awaits of a boundary inside an island, with its chunk", async () => {
    const shell = await renderToStream(() =>
      ssr(
        ["", "", ""],
        island("/src/Panel.stsx#Panel", Panel, {}, "idle"),
        createComponent(Suspense, {
          get fallback() {
            return ssr(["…"]);
          },
          get children() {
            return island("/src/Late.stsx#Late", Late, { value: "late" }, "visible");
          },
        }),
      ),
    );
    expect(records(shell.body)).toEqual([
      { id: 0, ref: "/src/Panel.stsx#Panel", strategy: "idle", props: {} },
    ]);
    const streamed: string[] = [];
    for await (const chunk of shell.stream!) streamed.push(chunk);
    const html = streamed.join("");
    expect(html).toContain('<template for="lb0"><p>inner</p></template>');
    expect(records(html)).toEqual([
      { id: 0, awaits: { "0.0.0:0:0": "inner" } },
      {
        id: 1,
        ref: "/src/Late.stsx#Late",
        strategy: "visible",
        props: { value: "late" },
        awaits: { "0:0:0": "late" },
      },
    ]);
  });
});
