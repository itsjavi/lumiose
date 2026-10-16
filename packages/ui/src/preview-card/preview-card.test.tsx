// Server HTML of Preview Card (TASK-381): a plain link that names its card and anchors it, and a
// manual popover placed next to it.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { PreviewCard } from "./preview-card.tsx";

describe("PreviewCard on the server", () => {
  it("renders the link with its card's id and delays, and the card as a manual popover", async () => {
    const html = await renderToString(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger href="/docs/signals" delay={300} closeDelay={100} class="link">
          signals
        </PreviewCard.Trigger>
        <PreviewCard.Popup side="top" sideOffset={6} class="card">
          Values that update what reads them.
        </PreviewCard.Popup>
      </PreviewCard.Root>
    ));
    const card = attrs(html, "div");
    expect(attrs(html, "a")).toEqual({
      href: "/docs/signals",
      class: "link",
      style: expect.stringContaining("anchor-name"),
      "data-preview-card": card.id,
      "data-delay": "300",
      "data-close-delay": "100",
    });
    expect(card).toMatchObject({
      class: "card",
      "data-side": "top",
      "data-align": "center",
      style: expect.stringContaining("position-anchor"),
      popover: "manual",
      "data-preview-card-popup": "",
    });
    // A visual enhancement: no role or ARIA wiring on the link.
    expect(card).not.toHaveProperty("role");
  });

  it("throws when a part is outside PreviewCard.Root", async () => {
    await expect(
      renderToString(() => <PreviewCard.Trigger href="/">x</PreviewCard.Trigger>),
    ).rejects.toThrow("PreviewCard.Trigger must be inside <PreviewCard.Root>.");
  });
});
