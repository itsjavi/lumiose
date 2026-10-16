// Server HTML of Avatar (TASK-374): `<lu-avatar>` around a native `<img>`, marked `data-loading`
// (hidden while scripting is enabled, until the script knows it has loaded), and a fallback
// `<span data-fallback>` whose `delay` becomes `--lu-avatar-delay`.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Avatar } from "./avatar.tsx";

describe("Avatar on the server", () => {
  it("renders the image in the server HTML, loading, over the fallback", async () => {
    const html = await renderToString(() => (
      <Avatar.Root class="lu-avatar">
        <Avatar.Image src="/ada.jpg" alt="Ada Lovelace" width={40} height={40} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    ));
    expect(attrs(html, "lu-avatar")).toEqual({ class: "lu-avatar" });
    expect(attrs(html, "img")).toEqual({
      src: "/ada.jpg",
      alt: "Ada Lovelace",
      width: "40",
      height: "40",
      "data-loading": "",
    });
    expect(html).toMatch(/<span data-fallback>AL<\/span><\/lu-avatar>$/);
  });

  it("delays the fallback through a CSS variable, in front of the caller's style", async () => {
    const html = await renderToString(() => (
      <Avatar.Root>
        <Avatar.Fallback delay={600} style={{ color: "red" }}>
          AL
        </Avatar.Fallback>
        <Avatar.Fallback style="color: blue">AL</Avatar.Fallback>
      </Avatar.Root>
    ));
    const [first, second] = [...html.matchAll(/<span ([^>]*)>/g)].map((match) => match[1]);
    expect(first!.replaceAll(" ", "")).toBe(
      'data-fallbackstyle="--lu-avatar-delay:600ms;color:red"',
    );
    expect(second).toBe('data-fallback style="color: blue"');
  });
});
