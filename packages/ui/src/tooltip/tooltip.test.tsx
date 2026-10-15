// Server HTML of Tooltip (TASK-356): the trigger is described by the tip from the server HTML on,
// and carries the delays the client script reads. Behaviour in a browser is checked by
// examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Tooltip } from "./tooltip.tsx";

describe("Tooltip on the server", () => {
  it("describes the trigger by the tip and anchors the tip to it", async () => {
    const html = await renderToString(() => (
      <Tooltip.Root>
        <Tooltip.Trigger aria-label="Bold">B</Tooltip.Trigger>
        <Tooltip.Popup class="tip">Bold (Ctrl+B)</Tooltip.Popup>
      </Tooltip.Root>
    ));
    const trigger = attrs(html, "button");
    const tip = attrs(html, "span");
    expect(tip).toMatchObject({
      class: "tip",
      popover: "hint",
      role: "tooltip",
      "data-side": "top",
      "data-align": "center",
    });
    expect(trigger).toMatchObject({
      type: "button",
      "aria-label": "Bold",
      "aria-describedby": tip.id,
    });
    // Defaults are the client script's: no attributes for them.
    expect(trigger).not.toHaveProperty("data-delay");
    expect(trigger).not.toHaveProperty("data-close-on-click");
    const anchor = /anchor-name:\s*(--lu-[\w-]+)/.exec(trigger.style!)![1];
    expect(tip.style).toMatch(new RegExp(`position-anchor:\\s*${anchor}`));
  });

  it("writes the delays, closeOnClick, disabled and the hoverable opt-out", async () => {
    const html = await renderToString(() => (
      <Tooltip.Root disabled disableHoverablePopup>
        <Tooltip.Trigger delay={200} closeDelay={100} closeOnClick={false} aria-describedby="hint">
          Pin
        </Tooltip.Trigger>
        <Tooltip.Popup side="bottom">Pinned</Tooltip.Popup>
      </Tooltip.Root>
    ));
    const trigger = attrs(html, "button");
    const tip = attrs(html, "span");
    expect(trigger).toMatchObject({
      "data-delay": "200",
      "data-close-delay": "100",
      "data-close-on-click": "false",
      "data-trigger-disabled": "",
      // The caller's description is kept, after the tip.
      "aria-describedby": `${tip.id} hint`,
    });
    expect(tip).toMatchObject({ "data-side": "bottom", "data-disable-hoverable-popup": "" });
  });

  it("throws when a part is outside Tooltip.Root", async () => {
    await expect(renderToString(() => <Tooltip.Popup>Lost</Tooltip.Popup>)).rejects.toThrow(
      "Tooltip parts must be inside <Tooltip.Root>.",
    );
  });
});
