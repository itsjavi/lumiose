// @vitest-environment happy-dom
// Strict-CSP style rules (decision-77): their precedence against the page's rules, and one rule per
// distinct declaration block, across streamed boundaries (TASK-521).
import { describe, expect, it } from "vitest";
import { Suspense } from "./components.ts";
import { $await, $leave, createComponent, renderToStream, ssr, styleAttr } from "./index.ts";

type Props = any;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function chunks(stream: ReadableStream<string> | null): Promise<string[]> {
  const out: string[] = [];
  if (stream === null) return out;
  for await (const chunk of stream) out.push(chunk);
  return out;
}

/** An async component: after `ms`, a `<p>` with the style `style`. */
async function StyledAfter(props: Props) {
  try {
    (await $await(() => sleep(props.ms), 0))();
    return ssr(["<p", ">x</p>"], styleAttr(props.style));
  } finally {
    $leave();
  }
}

const styled = (ms: number, style: string) => createComponent(StyledAfter, { ms, style });

function suspense(children: () => unknown) {
  return createComponent(Suspense, {
    get fallback() {
      return ssr(["<p>…</p>"]);
    },
    get children() {
      return children();
    },
  });
}

/**
 * A styled icon rendered among the page's rules, with or without strict CSP, and its computed
 * aspect ratio, color and opacity.
 */
async function iconStyles(strictStyles: boolean) {
  const shell = await renderToStream(
    () =>
      ssr(
        ["<p class=icon data-l-x", ">x</p>"],
        styleAttr({ "aspect-ratio": "16 / 9", color: "blue", opacity: "1" }),
      ),
    { strictStyles },
  );
  document.head.innerHTML =
    // A scoped rule, and an !important one (which wins over inline styles too).
    "<style>.icon[data-l-x]{aspect-ratio:1;color:red}.icon{opacity:0.5 !important}</style>" +
    shell.head;
  // A scoped default later in the page, which outweighed the former `[data-l-v="N"]` rules.
  document.body.innerHTML = `${shell.body}<style>:where(.icon)[data-l-x]{color:green}</style>`;
  const icon = document.querySelector<HTMLElement>(".icon")!;
  const style = getComputedStyle(icon);
  return { icon, values: [style.aspectRatio, style.color, style.opacity] };
}

/** A list item with three style props: one value for all, one of 12, one of 100. */
function row(i: number) {
  return ssr(
    ["<li", "><i", "></i><b", "></b></li>"],
    styleAttr({ "aspect-ratio": "1" }),
    styleAttr({ "--hue": String((i % 12) * 30) }),
    styleAttr({ width: `${(i * 7) % 100}%` }),
  );
}

// happy-dom weighs `:not(#a#b)` as one class, not two ids: the rule's win over id selectors is
// checked in Chromium, Firefox and WebKit instead (TASK-521 notes).
describe("strict CSP style precedence (TASK-521)", () => {
  it("applies a style prop as an inline style does: over scoped rules, under !important ones", async () => {
    const inline = await iconStyles(false);
    expect(inline.values).toEqual(["16 / 9", "blue", "0.5"]);
    const strict = await iconStyles(true);
    expect(strict.icon.getAttribute("style")).toBeNull();
    expect(strict.values).toEqual(inline.values);
  });

  it("gives way to the styles the client sets through the CSSOM once the element hydrates", async () => {
    const { icon } = await iconStyles(true);
    icon.style.setProperty("color", "purple");
    icon.style.setProperty("aspect-ratio", "2 / 1");
    const style = getComputedStyle(icon);
    expect([style.color, style.aspectRatio]).toEqual(["purple", "2 / 1"]);
  });
});

describe("strict CSP style rules", () => {
  it("writes one rule per distinct declaration block in a long list", async () => {
    const items = 1600;
    const shell = await renderToStream(
      () =>
        ssr(
          ["<ul>", "</ul>"],
          Array.from({ length: items }, (_, i) => row(i)),
        ),
      { strictStyles: true },
    );
    // 1 + 12 + 100 distinct blocks for 4,800 style props.
    expect(shell.head.match(/\[data-l-v=/g)).toHaveLength(113);
    expect(shell.body.match(/ data-l-v="0"/g)).toHaveLength(items);
    expect(shell.body).toContain('<li data-l-v="0"><i data-l-v="1"></i><b data-l-v="2"></b></li>');
    expect(shell.head).toContain('[data-l-v="0"]:not(#a#b){aspect-ratio:1}');
  });

  it("reuses a rule of the units a boundary streams inside, or of flushed ones, but not of pending siblings", async () => {
    const shell = await renderToStream(
      () =>
        ssr(
          ["<p", ">x</p>", "", "", ""],
          styleAttr("color:red"),
          // a: red from the shell; blue first; green once b flushed; its nested boundary reuses blue.
          suspense(() =>
            ssr(
              ["", "", "", ""],
              styled(2, "color:red"),
              styled(2, "color:blue"),
              styled(30, "color:green"),
              suspense(() => styled(5, "color:blue")),
            ),
          ),
          // b: blue while a is still pending, so a rule of its own.
          suspense(() => styled(10, "color:blue")),
          // c: blue once b flushed: b's rule.
          suspense(() => styled(50, "color:blue")),
        ),
      { strictStyles: true },
    );
    expect(shell.body.startsWith('<p data-l-v="0">x</p>')).toBe(true);
    expect(shell.head).toBe('<style>[data-l-v="0"]:not(#a#b){color:red}</style>');
    const [b, a, nested, c] = (await chunks(shell.stream)).map((chunk) => ({
      rules: chunk.match(/<style>.*?<\/style>/)?.[0] ?? "",
      ids: [...chunk.matchAll(/<p data-l-v="(\d+)">/g)].map((match) => Number(match[1])),
    }));
    expect(b).toEqual({ rules: '<style>[data-l-v="2"]:not(#a#b){color:blue}</style>', ids: [2] });
    expect(a).toEqual({
      rules:
        '<style>[data-l-v="1"]:not(#a#b){color:blue}[data-l-v="3"]:not(#a#b){color:green}</style>',
      ids: [0, 1, 3],
    });
    expect(nested).toEqual({ rules: "", ids: [1] });
    expect(c).toEqual({ rules: "", ids: [2] });
  });
});
