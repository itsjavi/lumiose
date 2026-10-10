// Island markers, slots, records and await records (decision-9, spec §7.2, §7.4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locals, runInRequestScope, type RequestScope } from "../app/server/scope.ts";
import { createContext, onCleanup, signal, useContext } from "../core/server.ts";
import { ErrorBoundary, Suspense } from "./components.ts";
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

function Card(props: Props) {
  return props.open ? ssr(["<div>", "</div>"], insert(props.icon)) : ssr(["<div></div>"]);
}

async function Later(props: Props) {
  try {
    const label = (await $await(() => sleep(1).then(() => "ready"), 0))();
    return ssr(["<p>", "", "</p>"], text(label), insert(props.children));
  } finally {
    $leave();
  }
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

  it("adds the island loader once: in the head for shell islands, else with the first chunk", async () => {
    const loaderUrl = "/assets/loader-abc.js";
    const tag = '<script type="module" async src="/assets/loader-abc.js"></script>';
    const shell = await renderToStream(
      () =>
        ssr(
          ["", "", ""],
          island("/src/Counter.stsx#Counter", Counter, {}, "idle"),
          island("/src/Counter.stsx#Counter", Counter, {}, "idle"),
        ),
      { loaderUrl },
    );
    expect(shell.head).toBe(tag);
    expect(shell.body).not.toContain('<script type="module"');

    const none = await renderToStream(() => ssr(["<p>static</p>"]), { loaderUrl });
    expect(none.head).toBe("");

    const streamed = await renderToStream(
      () =>
        createComponent(Suspense, {
          get fallback() {
            return ssr(["…"]);
          },
          get children() {
            return island("/src/Late.stsx#Late", Late, { value: "late" }, "visible");
          },
        }),
      { loaderUrl, nonce: "n1" },
    );
    expect(streamed.head).toBe("");
    let chunks = "";
    for await (const chunk of streamed.stream!) chunks += chunk;
    expect(chunks.split('<script type="module"')).toHaveLength(2);
    expect(chunks).toContain(
      '<script type="module" async src="/assets/loader-abc.js" nonce="n1"></script>',
    );
    expect(chunks.indexOf("loader-abc.js")).toBeLessThan(chunks.indexOf("data-l-islands"));
  });

  it("renders slots inline where the island renders them (golden 5.5), with the strategy value", async () => {
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
      "<!--l:0--><section>1,2<!--[--><!--l:s:children--><p>footer</p><!--/l:s--><!--]--></section><!--/l:0-->",
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

  it("sends slots the island did not render as templates, once", async () => {
    const slots = { icon: () => ssr(["<svg></svg>"]), children: () => ssr(["<p>body</p>"]) };
    const closed = await renderToStream(() =>
      island("/src/Card.stsx#Card", Card, { open: false }, "idle", undefined, slots),
    );
    expect(closed.body.split("<script")[0]).toBe(
      '<!--l:0--><template data-l-slot="icon"><svg></svg></template>' +
        '<template data-l-slot="children"><p>body</p></template><div></div><!--/l:0-->',
    );
    const open = await renderToStream(() =>
      island("/src/Card.stsx#Card", Card, { open: true }, "idle", undefined, slots),
    );
    expect(open.body.split("<script")[0]).toBe(
      '<!--l:0--><template data-l-slot="children"><p>body</p></template>' +
        "<div><!--[--><!--l:s:icon--><svg></svg><!--/l:s--><!--]--></div><!--/l:0-->",
    );
    expect(records(open.body)[0].slots).toEqual(["icon", "children"]);
  });

  it("knows the inline slots of async islands once they resolve", async () => {
    const shell = await renderToStream(() =>
      island("/src/Later.stsx#Later", Later, {}, "load", undefined, {
        children: () => ssr(["<i>kid</i>"]),
      }),
    );
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><!--[--><p>ready<!--[--><!--l:s:children--><i>kid</i><!--/l:s--><!--]--></p><!--]--><!--/l:0-->",
    );
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

function Fails(): unknown {
  throw new Error("nope");
}

async function Rejects(): Promise<unknown> {
  try {
    (await $await(() => Promise.reject(new Error("later")), 0))();
    return ssr(["never"]);
  } finally {
    $leave();
  }
}

function boundaries() {
  return ssr(
    ["<div>", "", "", "", "</div>"],
    createComponent(Suspense, {
      get fallback() {
        return ssr(["…"]);
      },
      get children() {
        return ssr(["<b>sync</b>"]);
      },
    }),
    createComponent(ErrorBoundary, {
      fallback: ssr(["<i>fallback</i>"]),
      get children() {
        return ssr(["<b>fine</b>"]);
      },
    }),
    createComponent(ErrorBoundary, {
      fallback: (error: Error) => ssr(["<i>", "</i>"], text(error.message)),
      get children() {
        return createComponent(Fails, {});
      },
    }),
    createComponent(ErrorBoundary, {
      fallback: (error: Error) => ssr(["<i>", "</i>"], text(error.message)),
      get children() {
        return createComponent(Rejects, {});
      },
    }),
  );
}

describe("boundary and async instance blocks", () => {
  it("wraps Suspense and ErrorBoundary ranges inside islands; failed boundaries open with [!", async () => {
    const shell = await renderToStream(() => island("/src/B.stsx#B", boundaries, {}, "idle"));
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><div><!--[--><b>sync</b><!--]--><!--[--><b>fine</b><!--]-->" +
        "<!--[!--><i>nope</i><!--]--><!--[!--><i>later</i><!--]--></div><!--/l:0-->",
    );
  });

  it("wraps resolved boundaries and an async island root too (prerender)", async () => {
    const shell = await renderToStream(() => island("/src/Panel.stsx#Panel", Panel, {}, "idle"), {
      resolveAll: true,
    });
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><aside><!--[--><!--[--><p>inner</p><!--]--><!--]--></aside><!--/l:0-->",
    );
    const root = await renderToStream(() =>
      island("/src/Late.stsx#Late", Late, { value: 1 }, "idle"),
    );
    expect(root.body.split("<script")[0]).toBe("<!--l:0--><!--[--><p>1</p><!--]--><!--/l:0-->");
  });

  it("adds no markers outside islands", async () => {
    const shell = await renderToStream(boundaries);
    expect(shell.body).toBe("<div><b>sync</b><b>fine</b><i>nope</i><i>later</i></div>");
  });
});

describe("await records", () => {
  it("records awaited values under instancePath:site:occurrence", async () => {
    const shell = await renderToStream(() => island("/src/Team.stsx#Team", Team, {}, "idle"));
    expect(shell.body.split("<script")[0]).toBe(
      "<!--l:0--><div><!--[--><h3>ada<!--!-->#1#2</h3><!--]-->" +
        "<!--[--><h3>bob<!--!-->#1#2</h3><!--]--></div><!--/l:0-->",
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
    // The boundary's block wraps the placeholder; the streamed content replaces the placeholder.
    expect(shell.body).toContain('<aside><!--[--><?start name="lb0">…<?end><!--]--></aside>');
    const streamed: string[] = [];
    for await (const chunk of shell.stream!) streamed.push(chunk);
    const html = streamed.join("");
    expect(html).toContain('<template for="lb0"><!--[--><p>inner</p><!--]--></template>');
    expect(html).toContain('<template for="lb1"><!--l:1--><!--[--><p>late</p><!--]--><!--/l:1-->');
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

describe("island context (TASK-194)", () => {
  // Islands hydrate as their own root, so on the server they do not see the page's context either.
  const Theme = createContext("default");

  function ThemeLabel() {
    return ssr(["<i>", "</i>"], text(useContext(Theme)));
  }

  function Themed(props: Props) {
    const own = useContext(Theme);
    return ssr(
      ["<b>", "</b>", ""],
      text(own),
      createComponent(Theme, {
        value: "island",
        get children(): any {
          return ssr(["", "", ""], createComponent(ThemeLabel, {}), insert(props.children));
        },
      }),
    );
  }

  async function AsyncThemed() {
    try {
      const before = useContext(Theme);
      (await $await(() => sleep(1), 0))();
      return ssr(["<b>", "", "</b>"], text(before), text(useContext(Theme)));
    } finally {
      $leave();
    }
  }

  function page(ref: string, component: (props: Props) => unknown, slot?: () => unknown) {
    return createComponent(Theme, {
      value: "page",
      get children(): any {
        return ssr(
          ["", "", ""],
          createComponent(ThemeLabel, {}),
          island(ref, component, {}, "idle", undefined, slot && { children: slot }),
        );
      },
    });
  }

  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("gives islands the default, and the values provided inside them; slots keep the page's", async () => {
    const shell = await renderToStream(() =>
      page("/src/Themed.stsx#Themed", Themed, () => createComponent(ThemeLabel, {})),
    );
    expect(shell.body.split("<script")[0]).toBe(
      "<i>page</i><!--l:0--><b>default</b><i>island</i><!--[--><!--l:s:children--><i>page</i><!--/l:s--><!--]--><!--/l:0-->",
    );
    const async = await renderToStream(() =>
      page("/src/AsyncThemed.stsx#AsyncThemed", AsyncThemed),
    );
    expect(async.body.split("<script")[0]).toBe(
      "<i>page</i><!--l:0--><!--[--><b>default<!--!-->default</b><!--]--><!--/l:0-->",
    );
  });

  it("warns LUM4010 once per island when it reads a context the page provided", async () => {
    await renderToStream(() => page("/src/Warned.stsx#Warned", Themed));
    await renderToStream(() => page("/src/Warned.stsx#Warned", Themed));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(
      /^Lumiose: LUM4010: island Warned \(\/src\/Warned\.stsx#Warned\) calls useContext\(\) for a context that the page provides outside the island\./,
    );
    // Not provided by the page, or provided inside the island: nothing to warn about.
    await renderToStream(() => island("/src/Quiet.stsx#Quiet", Themed, {}, "idle"));
    await renderToStream(() =>
      page("/src/Inner.stsx#Inner", () =>
        createComponent(Theme, {
          value: "inner",
          get children(): any {
            return createComponent(ThemeLabel, {});
          },
        }),
      ),
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps Suspense, error boundaries, request APIs and the page's lifetime inside islands", async () => {
    let cleaned = 0;
    function Request() {
      onCleanup(() => cleaned++);
      return ssr(["<p>", "</p>"], text((locals() as { user: string }).user));
    }
    const scope = { ctx: { locals: { user: "ada" } } } as unknown as RequestScope;
    const shell = await runInRequestScope(scope, () =>
      renderToStream(() =>
        page("/src/Request.stsx#Request", () =>
          ssr(["", "", ""], createComponent(Request, {}), boundaries()),
        ),
      ),
    );
    expect(shell.body.split("<script")[0]).toBe(
      "<i>page</i><!--l:0--><p>ada</p><div><!--[--><b>sync</b><!--]--><!--[--><b>fine</b><!--]--><!--[!--><i>nope</i><!--]--><!--[!--><i>later</i><!--]--></div><!--/l:0-->",
    );
    expect(cleaned).toBe(1);
  });
});
