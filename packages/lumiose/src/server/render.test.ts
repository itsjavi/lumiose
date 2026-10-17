// Shell-first rendering, Suspense streaming, ErrorBoundary, head and context frames, with
// hand-compiled server components (contract doc-2 §4-5).
import { describe, expect, it, vi } from "vitest";
import { createContext, getAbortSignal, onCleanup, useContext } from "../core/server.ts";
import { redirect } from "../app/server/control.ts";
import { ErrorBoundary, Head, Meta, Suspense, Title } from "./components.ts";
import {
  $await,
  $leave,
  createComponent,
  insert,
  renderToStream,
  ssr,
  styleAttr,
  text,
} from "./index.ts";
import { SWAP_SCRIPT, type RenderToStreamOptions } from "./render.ts";

type Props = any;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function chunks(stream: ReadableStream<string> | null): Promise<string[]> {
  const out: string[] = [];
  if (stream === null) return out;
  for await (const chunk of stream) out.push(chunk);
  return out;
}

/** `async function Slow({ wait })` awaiting `wait` and rendering it in a <p>. */
async function Slow(props: Props) {
  try {
    const value = (await $await(() => props.wait, 0))();
    return ssr(["<p>", "</p>"], text(value));
  } finally {
    $leave();
  }
}

function suspense(fallback: string, children: () => unknown) {
  return createComponent(Suspense, {
    get fallback() {
      return ssr([`<p>${fallback}</p>`]);
    },
    get children() {
      return children();
    },
  });
}

const slow = (wait: unknown) => createComponent(Slow, { wait });

function chunkFor(name: string, html: string) {
  return `<template for="${name}">${html}</template><script>$swap("${name}")</script>`;
}

async function RedirectAfterAwait(props: Props) {
  try {
    (await $await(() => sleep(1), 0))();
    redirect(props.to);
  } finally {
    $leave();
  }
}

function Throws(): never {
  throw new Error("sync <boom>");
}

function errorBoundary(children: () => unknown) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (error: Error) => ssr(["<p role=alert>", "</p>"], text(error.message));
    },
    get children() {
      return children();
    },
  });
}

function title(value: string) {
  return createComponent(Title, {
    get children() {
      return value;
    },
  });
}

function Layout(props: Props) {
  return ssr(
    ["", "", "", "<div>", "</div>", ""],
    title("Site"),
    createComponent(Meta, { name: "description", content: "site" }),
    createComponent(Meta, { charset: "utf-8" }),
    insert(props.children),
    createComponent(Head, {
      get children() {
        return ssr(['<link rel="icon" href="/favicon.ico">']);
      },
    }),
  );
}
async function Page() {
  try {
    const name = (await $await(() => sleep(1).then(() => "Post <1>"), 0))();
    return ssr(
      ["<h1>", "</h1>", "", ""],
      text(name),
      title(`${name} | Site`),
      createComponent(Meta, { name: "description", content: `About ${name}` }),
    );
  } finally {
    $leave();
  }
}

function titleInBoundary() {
  return suspense("…", () => ssr(["", "", ""], slow(sleep(1)), title("Late")));
}

describe("renderToStream: the shell", () => {
  it("resolves with the shell and no stream when nothing is suspended", async () => {
    const shell = await renderToStream(() => ssr(["<h1>", "</h1>"], text("hi")));
    expect(shell).toEqual({ head: "", body: "<h1>hi</h1>", stream: null });
  });

  it("holds the shell until async content outside <Suspense> resolves", async () => {
    const shell = await renderToStream(() =>
      ssr(
        ["<main>", "", "</main>"],
        insert(slow(sleep(5).then(() => "late"))),
        insert(slow("now")),
      ),
    );
    expect(shell.body).toBe("<main><p>late</p><p>now</p></main>");
    expect(shell.stream).toBeNull();
  });

  it("rejects with the first thrown shell value, unwrapped", async () => {
    const rejection = await renderToStream(() =>
      createComponent(RedirectAfterAwait, { to: "/login" }),
    ).catch((e) => e);
    expect(rejection).toMatchObject({ location: "/login", status: undefined });

    await expect(
      renderToStream(() => {
        throw "plain value";
      }),
    ).rejects.toBe("plain value");

    const first = new Error("first");
    await expect(
      renderToStream(() =>
        ssr(
          ["", "", ""],
          slow(sleep(1).then(() => Promise.reject(first))),
          slow(sleep(10).then(() => Promise.reject(new Error("second")))),
        ),
      ),
    ).rejects.toBe(first);
  });

  it("rejects with the abort reason when aborted before the shell", async () => {
    const controller = new AbortController();
    const pending = renderToStream(() => slow(sleep(20)), { signal: controller.signal });
    controller.abort(new Error("gone"));
    await expect(pending).rejects.toThrow("gone");
  });
});

describe("Suspense streaming", () => {
  it("streams boundaries out of order after the shell with one $swap script", async () => {
    const a = Promise.withResolvers<string>();
    const b = Promise.withResolvers<string>();
    const gate = Promise.withResolvers<string>();
    const rendering = renderToStream(() =>
      ssr(
        ["<main>", "", "", "</main>"],
        insert(suspense("loading a", () => slow(a.promise))),
        insert(suspense("loading b", () => slow(b.promise))),
        insert(slow(gate.promise)),
      ),
    );
    b.resolve("b");
    await sleep(1);
    gate.resolve("shell");
    const shell = await rendering;
    expect(shell.body).toBe(
      '<main><?start name="lb0"><p>loading a</p><?end><?start name="lb1"><p>loading b</p><?end><p>shell</p></main>',
    );
    const reader = shell.stream!.getReader();
    expect((await reader.read()).value).toBe(
      `<script>${SWAP_SCRIPT}</script>${chunkFor("lb1", "<p>b</p>")}`,
    );
    a.resolve("a <&>");
    expect((await reader.read()).value).toBe(chunkFor("lb0", "<p>a &lt;&amp;></p>"));
    expect((await reader.read()).done).toBe(true);
  });

  it("flushes a nested boundary only after its parent", async () => {
    const outer = Promise.withResolvers<string>();
    const shell = await renderToStream(() =>
      suspense("outer", () =>
        ssr(
          ["<section>", "", "</section>"],
          slow(outer.promise),
          suspense("inner", () => slow("inner")),
        ),
      ),
    );
    // Names are assigned when a boundary turns out async: the inner one is known first.
    expect(shell.body).toBe('<?start name="lb1"><p>outer</p><?end>');
    const reading = chunks(shell.stream);
    await sleep(1);
    outer.resolve("outer done");
    expect(await reading).toEqual([
      `<script>${SWAP_SCRIPT}</script>` +
        chunkFor(
          "lb1",
          '<section><p>outer done</p><?start name="lb0"><p>inner</p><?end></section>',
        ),
      chunkFor("lb0", "<p>inner</p>"),
    ]);
  });

  it("renders synchronous boundary content inline, without a fallback", async () => {
    const shell = await renderToStream(() => suspense("never", () => ssr(["<p>sync</p>"])));
    expect(shell).toEqual({ head: "", body: "<p>sync</p>", stream: null });
  });

  it("renders everything resolved with resolveAll (SSG)", async () => {
    const shell = await renderToStream(
      () =>
        ssr(
          ["<main>", "</main>"],
          insert(
            suspense("loading", () =>
              ssr(
                ["<div>", "", "</div>"],
                slow(sleep(2).then(() => "x")),
                suspense("inner", () => slow("y")),
              ),
            ),
          ),
        ),
      { resolveAll: true },
    );
    expect(shell).toEqual({
      head: "",
      body: "<main><div><p>x</p><p>y</p></div></main>",
      stream: null,
    });
  });

  it("puts the nonce on the swap scripts", async () => {
    const shell = await renderToStream(() => suspense("…", () => slow(sleep(1).then(() => "z"))), {
      nonce: 'n"1',
    });
    const [chunk] = await chunks(shell.stream);
    expect(chunk).toBe(
      `<script nonce="n&quot;1">${SWAP_SCRIPT}</script><template for="lb0"><p>z</p></template><script nonce="n&quot;1">$swap("lb0")</script>`,
    );
  });

  it("keeps the fallback and reports unhandled boundary errors; other boundaries still stream", async () => {
    const onError = vi.fn();
    const failure = new Error("db down");
    const shell = await renderToStream(
      () =>
        ssr(
          ["", "", ""],
          suspense("a", () => slow(sleep(1).then(() => Promise.reject(failure)))),
          suspense("b", () => slow(sleep(3).then(() => "b"))),
        ),
      { onError },
    );
    expect(await chunks(shell.stream)).toEqual([
      `<script>${SWAP_SCRIPT}</script>${chunkFor("lb1", "<p>b</p>")}`,
    ]);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("turns redirect() inside a streamed boundary into LUM5004", async () => {
    const onError = vi.fn();
    const shell = await renderToStream(
      () => suspense("…", () => createComponent(RedirectAfterAwait, { to: "/elsewhere" })),
      {
        onError,
      },
    );
    expect(await chunks(shell.stream)).toEqual([]);
    expect(onError.mock.calls[0]![0]).toMatchObject({
      code: "LUM5004",
      cause: { location: "/elsewhere" },
    });
  });

  it("aborting the request ends the stream and aborts getAbortSignal()", async () => {
    const controller = new AbortController();
    let life: AbortSignal | undefined;
    async function Watch() {
      try {
        life = getAbortSignal();
        (await $await(() => sleep(50), 0))();
        return ssr(["late"]);
      } finally {
        $leave();
      }
    }
    const shell = await renderToStream(() => suspense("…", () => createComponent(Watch, {})), {
      signal: controller.signal,
    });
    const reading = chunks(shell.stream);
    controller.abort();
    expect(await reading).toEqual([]);
    expect(life!.aborted).toBe(true);
  });
});

describe("ErrorBoundary", () => {
  it("gives fallbacks a generic error with a digest in production, and logs the original (decision-29)", async () => {
    const logged: unknown[] = [];
    const shell = await renderToStream(() => errorBoundary(() => createComponent(Throws, {})), {
      sanitizeErrors: true,
      onError: (error) => logged.push(error),
    });
    const digest = /digest ([0-9a-f]{8})/.exec(shell.body)?.[1];
    expect(digest).toBeDefined();
    expect(shell.body).not.toContain("boom");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ message: "sync <boom>", digest });
    // HttpErrors are meant for users: they reach the fallback as they are. Dev keeps raw errors.
    const raw = await renderToStream(() => errorBoundary(() => createComponent(Throws, {})));
    expect(raw.body).toContain("sync &lt;boom>");
  });

  it("renders the fallback in place for sync throws and async rejections", async () => {
    const shell = await renderToStream(() =>
      ssr(
        ["<main>", "", "</main>"],
        errorBoundary(() => createComponent(Throws, {})),
        errorBoundary(() => slow(sleep(1).then(() => Promise.reject(new Error("async boom"))))),
      ),
    );
    expect(shell.body).toBe(
      "<main><p role=alert>sync &lt;boom></p><p role=alert>async boom</p></main>",
    );
  });

  it("lets redirect() in the shell reach the request handler", async () => {
    const rejection = await renderToStream(() =>
      errorBoundary(() => {
        redirect("/login");
      }),
    ).catch((e) => e);
    expect(rejection).toMatchObject({ location: "/login" });
  });

  it("catches errors inside a streamed boundary, with LUM5004 for redirects", async () => {
    const shell = await renderToStream(() =>
      suspense("…", () => errorBoundary(() => createComponent(RedirectAfterAwait, { to: "/x" }))),
    );
    const [chunk] = await chunks(shell.stream);
    expect(chunk).toContain('<template for="lb0"><p role=alert>redirect() was called inside');
    expect(chunk).toContain("LUM5004");
  });

  it("does not catch errors outside its children", async () => {
    await expect(
      renderToStream(() =>
        ssr(
          ["", "", ""],
          errorBoundary(() => ssr(["ok"])),
          slow(Promise.reject(new Error("outside"))),
        ),
      ),
    ).rejects.toThrow("outside");
  });
});

describe("head", () => {
  it("collects Title, Meta and Head; the deepest Title and metas win", async () => {
    const shell = await renderToStream(() =>
      createComponent(Layout, {
        get children() {
          return createComponent(Page, {});
        },
      }),
    );
    expect(shell.head).toBe(
      "<title>Post &lt;1> | Site</title>" +
        '<meta name="description" content="About Post <1>"><meta charset="utf-8">' +
        '<link rel="icon" href="/favicon.ico">',
    );
    expect(shell.body).toBe("<div><h1>Post &lt;1></h1></div>");
  });

  it("rejects head changes inside a streamed boundary (LUM5004), but not with resolveAll", async () => {
    const onError = vi.fn();
    const shell = await renderToStream(titleInBoundary, { onError });
    expect(await chunks(shell.stream)).toEqual([]);
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "LUM5004" });
    expect(onError.mock.calls[0]![0].message).toMatch(/<Title> inside a streamed <Suspense>/);

    const resolved = await renderToStream(titleInBoundary, { resolveAll: true });
    expect(resolved.head).toBe("<title>Late</title>");
  });
});

describe("context frames", () => {
  const Theme = createContext("none");

  async function Reader(props: Props) {
    try {
      (await $await(() => sleep(props.ms), 0))();
      const first = useContext(Theme);
      let caught = "";
      try {
        (await $await(() => sleep(props.ms).then(() => Promise.reject(new Error("x"))), 1))();
      } catch {
        caught = useContext(Theme);
      }
      return ssr(["<i>", "|", "</i>", ""], text(first), text(caught), createComponent(Nested, {}));
    } finally {
      $leave();
    }
  }

  async function Nested() {
    try {
      (await $await(() => sleep(1), 0))();
      return ssr(["<b>", "</b>"], text(useContext(Theme)));
    } finally {
      $leave();
    }
  }

  const app = (value: string, ms: number) => () =>
    createComponent(Theme, {
      value,
      get children(): any {
        return [createComponent(Reader, { ms }), createComponent(Reader, { ms: ms * 2 })];
      },
    });

  it("restores context after awaits, without leaking between concurrent renders", async () => {
    const [a, b] = await Promise.all([renderToStream(app("a", 6)), renderToStream(app("b", 3))]);
    expect(a.body).toBe("<i>a|a</i><b>a</b><i>a|a</i><b>a</b>");
    expect(b.body).toBe("<i>b|b</i><b>b</b><i>b|b</i><b>b</b>");
    expect(useContext(Theme)).toBe("none");
  });

  it("disposes the render: cleanups run and getAbortSignal() aborts", async () => {
    const log: string[] = [];
    let life: AbortSignal | undefined;
    async function Comp() {
      try {
        onCleanup(() => log.push("cleanup"));
        (await $await(() => sleep(1), 0))();
        life = getAbortSignal();
        return ssr(["x"]);
      } finally {
        $leave();
      }
    }
    await renderToStream(() => createComponent(Comp, {}));
    expect(log).toEqual(["cleanup"]);
    expect(life!.aborted).toBe(true);
  });
});

describe("strict CSP styles", () => {
  it("moves style props into nonce'd rules", async () => {
    const options: RenderToStreamOptions = { strictStyles: true, nonce: "abc" };
    const shell = await renderToStream(
      () => ssr(["<p", ">x</p>"], styleAttr({ color: "red", content: "'}<x'" })),
      options,
    );
    expect(shell.body).toBe('<p data-l-v="0">x</p>');
    expect(shell.head).toBe(
      `<style nonce="abc">[data-l-v="0"]{color:red;content:'\\7d \\3c x'}</style>`,
    );
  });
  it("closes what a style value leaves open, so it cannot swallow the next rules (TASK-472)", async () => {
    const rules = async (...values: string[]) => {
      const shell = await renderToStream(
        () => ssr(["<p", ">x</p>"], values.map((value) => styleAttr(value)).join("")),
        { strictStyles: true },
      );
      return shell.head.replace(/^<style>|<\/style>$/g, "");
    };
    expect(await rules("color:red /* note", "color:blue")).toBe(
      '[data-l-v="0"]{color:red /* note*/}[data-l-v="1"]{color:blue}',
    );
    expect(await rules("background:url(x", "color:blue")).toBe(
      '[data-l-v="0"]{background:url(x)}[data-l-v="1"]{color:blue}',
    );
    expect(await rules("content:'x", "color:blue")).toBe(
      `[data-l-v="0"]{content:'x'}[data-l-v="1"]{color:blue}`,
    );
    expect(await rules("width:calc(1px + var(--a", "color:blue")).toBe(
      '[data-l-v="0"]{width:calc(1px + var(--a))}[data-l-v="1"]{color:blue}',
    );
    expect(await rules("--x:[a", "color:blue")).toBe(
      '[data-l-v="0"]{--x:[a]}[data-l-v="1"]{color:blue}',
    );
    // Closed values stay as they are, quotes and parentheses in strings and urls included.
    for (const value of [
      "background:url('a(b.png')",
      "background:url(a.png) /* c */",
      'content:"(["',
      "width:calc((1px + 2px) * 3)",
    ]) {
      expect(await rules(value)).toBe(`[data-l-v="0"]{${value}}`);
    }
  });
});
