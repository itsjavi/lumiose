// Fully resolved responses and the streaming timeout (decision-58, TASK-340), at the renderer:
// `streaming()` turning false before or while the shell renders, and `streamTimeout`.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, Suspense } from "./components.ts";
import { $await, $leave, createComponent, insert, ssr, styleAttr, text } from "./index.ts";
import { renderShell, type ShellOptions, type ShellParts } from "./render.ts";

type Props = any;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const never = () => new Promise<string>(() => {});

async function chunks(stream: ReadableStream<string> | null): Promise<string> {
  let out = "";
  if (stream === null) return out;
  for await (const chunk of stream) out += chunk;
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

/** An async component whose output has a style prop (a rule of its unit with strict styles). */
async function Styled() {
  try {
    (await $await(() => sleep(2), 0))();
    return ssr(["<p", ">styled</p>"], styleAttr({ color: "red" }));
  } finally {
    $leave();
  }
}

const slow = (wait: unknown) => createComponent(Slow, { wait });

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

function errorBoundary(label: string, children: () => unknown) {
  return createComponent(ErrorBoundary, {
    get fallback() {
      return (error: Error & { code?: string }) =>
        ssr([`<p role=alert>${label} `, "</p>"], text(error.code ?? error.message));
    },
    get children() {
      return children();
    },
  });
}

const render = (root: () => unknown, options: ShellOptions): Promise<ShellParts> =>
  renderShell(root, options);

afterEach(() => {
  vi.useRealTimers();
});

describe("streaming() turned off", () => {
  it("before the first boundary: every boundary renders into the shell, and nothing streams", async () => {
    const shell = await render(
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
      { streaming: () => false },
    );
    expect(shell.html).toBe("<main><div><p>x</p><p>y</p></div></main>");
    expect(shell.stream).toBeNull();
  });

  it("while rendering: boundaries already streaming are waited for and inlined", async () => {
    let streams = true;
    function Off() {
      streams = false;
      return ssr(["<i>off</i>"]);
    }
    const shell = await render(
      () =>
        ssr(
          ["<main>", "", "", "</main>"],
          insert(
            suspense("a", () =>
              ssr(
                ["<div>", "", "</div>"],
                slow(sleep(3).then(() => "a")),
                suspense("inner", () => slow(sleep(1).then(() => "b"))),
              ),
            ),
          ),
          createComponent(Off, {}),
          insert(suspense("c", () => slow(sleep(1).then(() => "c")))),
        ),
      { streaming: () => streams },
    );
    expect(shell.html).toBe("<main><div><p>a</p><p>b</p></div><i>off</i><p>c</p></main>");
    expect(shell.stream).toBeNull();
  });

  it("while rendering: an inlined boundary brings its styles into the head", async () => {
    let streams = true;
    const shell = await render(
      () =>
        ssr(
          ["", "", ""],
          suspense("…", () => createComponent(Styled, {})),
          createComponent(() => {
            streams = false;
            return "";
          }, {}),
        ),
      { streaming: () => streams, strictStyles: true },
    );
    expect(shell.html).toBe('<p data-l-v="0">styled</p>');
    expect(shell.head).toBe('<style>[data-l-v="0"]:not(#a#b){color:red}</style>');
  });

  it("while rendering: a failed boundary keeps its fallback and is reported", async () => {
    let streams = true;
    const onError = vi.fn();
    const failure = new Error("db down");
    const shell = await render(
      () =>
        ssr(
          ["", "", ""],
          suspense("kept", () => slow(sleep(1).then(() => Promise.reject(failure)))),
          createComponent(() => {
            streams = false;
            return "<b>";
          }, {}),
        ),
      { streaming: () => streams, onError },
    );
    expect(shell.html).toBe('<?start name="lb0"><p>kept</p><?end>&lt;b>');
    expect(shell.stream).toBeNull();
    expect(onError).toHaveBeenCalledWith(failure, true);
  });

  it("while rendering: the client going away rejects the render with the abort reason", async () => {
    let streams = true;
    const controller = new AbortController();
    const rendering = render(
      () =>
        ssr(
          ["", "", ""],
          suspense("…", () => slow(never())),
          createComponent(() => {
            streams = false;
            return "";
          }, {}),
        ),
      { streaming: () => streams, signal: controller.signal },
    );
    await sleep(1);
    controller.abort(new Error("gone"));
    await expect(rendering).rejects.toThrow("gone");
  });
});

describe("streamTimeout", () => {
  it("fails a pending async component into the nearest ErrorBoundary of a streamed boundary", async () => {
    const onCaughtError = vi.fn();
    const shell = await render(
      () =>
        suspense("loading", () =>
          errorBoundary("outer", () =>
            ssr(
              ["<div>", "</div>"],
              errorBoundary("inner", () => slow(never())),
            ),
          ),
        ),
      { streamTimeout: 10, onCaughtError },
    );
    expect(shell.html).toBe('<?start name="lb0"><p>loading</p><?end>');
    const streamed = await chunks(shell.stream);
    expect(streamed).toContain(
      '<template for="lb0"><div><p role=alert>inner LUM5009</p></div></template>',
    );
    expect(onCaughtError).toHaveBeenCalledTimes(1);
    expect(onCaughtError.mock.calls[0]).toEqual([
      expect.objectContaining({ code: "LUM5009" }),
      { digest: undefined, streamed: true },
    ]);
    expect(onCaughtError.mock.calls[0]![0].message).toContain("streamTimeout");
  });

  it("keeps the fallback of a boundary still pending without an ErrorBoundary, reports it, and ends the stream", async () => {
    const onError = vi.fn();
    const shell = await render(
      () =>
        ssr(
          ["", "", ""],
          // A promise in content position is not an async component: the boundary itself fails.
          suspense("pending", () => never()),
          suspense("fast", () => slow(sleep(1).then(() => "fast"))),
        ),
      { streamTimeout: 10, onError },
    );
    const streamed = await chunks(shell.stream);
    expect(streamed).toContain('<template for="lb1"><p>fast</p></template>');
    expect(streamed).not.toContain('for="lb0"');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "LUM5009" }), true);
  });

  it("fails pending content into the nearest ErrorBoundary of the document when it does not stream", async () => {
    const shell = await render(
      () => suspense("…", () => errorBoundary("timed out", () => slow(never()))),
      { streaming: () => false, streamTimeout: 10 },
    );
    expect(shell.html).toBe("<p role=alert>timed out LUM5009</p>");
  });

  it("is ignored while prerendering (resolveAll)", async () => {
    const shell = await render(() => suspense("…", () => slow(sleep(20).then(() => "late"))), {
      resolveAll: true,
      streamTimeout: 1,
    });
    expect(shell.html).toBe("<p>late</p>");
  });

  it("stops its timer once the render ends", async () => {
    vi.useFakeTimers();
    const rendering = render(() => suspense("…", () => slow(sleep(5).then(() => "done"))), {
      streamTimeout: 30_000,
    });
    const shell = await rendering;
    const reading = chunks(shell.stream);
    await vi.advanceTimersByTimeAsync(5);
    expect(await reading).toContain("<p>done</p>");
    expect(vi.getTimerCount()).toBe(0);
  });
});
