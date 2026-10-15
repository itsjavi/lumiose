// Server HTML of Button, Toggle and ToggleGroup (TASK-364, TASK-369): native buttons, a soft
// disabled state that keeps focus, `aria-pressed`, and the group's single tab stop.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Toggle } from "../toggle/toggle.tsx";
import { ToggleGroup } from "../toggle-group/toggle-group.tsx";
import { Button } from "./button.tsx";

const buttons = (html: string) =>
  [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => attrs(`<button${m[1]}>`, "button"));

describe("Button on the server", () => {
  it("renders a native button of type button, or the type it is given", async () => {
    const html = await renderToString(() => (
      <>
        <Button class="b">Save</Button>
        <Button type="submit" name="intent" value="save">
          Save
        </Button>
      </>
    ));
    const [plain, submit] = buttons(html);
    expect(plain).toEqual({ type: "button", class: "b" });
    expect(submit).toEqual({ type: "submit", name: "intent", value: "save" });
  });

  it("is natively disabled, or aria-disabled and focusable with focusableWhenDisabled", async () => {
    const html = await renderToString(() => (
      <>
        <Button disabled>Off</Button>
        <Button disabled focusableWhenDisabled>
          Saving…
        </Button>
        <Button focusableWhenDisabled>On</Button>
      </>
    ));
    const [off, soft, on] = buttons(html);
    expect(off).toEqual({ type: "button", disabled: "" });
    expect(soft).toEqual({ type: "button", "aria-disabled": "true" });
    expect(on).toEqual({ type: "button" });
  });
});

describe("Toggle and ToggleGroup on the server", () => {
  it("renders a toggle as a button with aria-pressed", async () => {
    const html = await renderToString(() => (
      <>
        <Toggle aria-label="Bold">B</Toggle>
        <Toggle aria-label="Italic" defaultPressed>
          I
        </Toggle>
        <Toggle aria-label="Mute" pressed disabled>
          M
        </Toggle>
      </>
    ));
    const [bold, italic, mute] = buttons(html);
    expect(bold).toEqual({ type: "button", "aria-label": "Bold", "aria-pressed": "false" });
    expect(italic).toMatchObject({ "aria-pressed": "true" });
    expect(mute).toMatchObject({ "aria-pressed": "true", disabled: "" });
  });

  it("presses the group's value and gives its first pressed toggle the tab stop", async () => {
    const html = await renderToString(() => (
      <ToggleGroup aria-label="Alignment" defaultValue={["center"]} orientation="vertical">
        <Toggle value="left">Left</Toggle>
        <Toggle value="center">Center</Toggle>
        <Toggle value="right">Right</Toggle>
      </ToggleGroup>
    ));
    expect(attrs(html, "lu-toggle-group")).toEqual({
      "aria-label": "Alignment",
      role: "group",
      "data-orientation": "vertical",
    });
    expect(buttons(html).map((b) => [b.value, b["aria-pressed"], b.tabindex])).toEqual([
      ["left", "false", "-1"],
      ["center", "true", "0"],
      ["right", "false", "-1"],
    ]);
  });

  it("gives the first enabled toggle the tab stop when none is pressed", async () => {
    const html = await renderToString(() => (
      <ToggleGroup multiple loopFocus={false}>
        <Toggle value="a" disabled>
          A
        </Toggle>
        <Toggle value="b">B</Toggle>
        <Toggle value="c">C</Toggle>
      </ToggleGroup>
    ));
    expect(attrs(html, "lu-toggle-group")).toMatchObject({
      multiple: "",
      "data-loop-focus": "false",
    });
    expect(buttons(html).map((b) => [b.value, b.tabindex, b.disabled])).toEqual([
      ["a", "-1", ""],
      ["b", "0", undefined],
      ["c", "-1", undefined],
    ]);
  });

  it("disables every toggle of a disabled group", async () => {
    const html = await renderToString(() => (
      <ToggleGroup disabled>
        <Toggle value="a">A</Toggle>
        <Toggle value="b">B</Toggle>
      </ToggleGroup>
    ));
    expect(buttons(html).every((b) => b.disabled === "")).toBe(true);
  });
});
