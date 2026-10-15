// Server HTML of Collapsible (TASK-370): a native <details> whose state and wiring are in the
// markup before any script runs. Behaviour in a browser is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Collapsible } from "./collapsible.tsx";

function Keys(props: { open?: boolean; defaultOpen?: boolean; disabled?: boolean }) {
  return (
    <Collapsible.Root
      class="keys"
      name="group"
      open={props.open}
      defaultOpen={props.defaultOpen}
      disabled={props.disabled}
    >
      <Collapsible.Trigger class="trigger">Recovery keys</Collapsible.Trigger>
      <Collapsible.Panel class="panel">Store them safely.</Collapsible.Panel>
    </Collapsible.Root>
  );
}

describe("Collapsible on the server", () => {
  it("renders a closed <details> whose summary controls the panel", async () => {
    const html = await renderToString(() => <Keys />);
    const details = attrs(html, "details");
    expect(details).toMatchObject({ class: "keys", name: "group" });
    expect(details).not.toHaveProperty("open");
    const summary = attrs(html, "summary");
    expect(summary.class).toBe("trigger");
    expect(summary).not.toHaveProperty("aria-expanded");
    expect(summary).not.toHaveProperty("aria-disabled");
    const panel = attrs(html, "div", (a) => a.id === summary["aria-controls"]);
    expect(panel.class).toBe("panel");
    expect(summary.id).toMatch(/-trigger$/);
  });

  it("starts open from open or defaultOpen", async () => {
    expect(attrs(await renderToString(() => <Keys defaultOpen />), "details")).toHaveProperty(
      "open",
    );
    expect(attrs(await renderToString(() => <Keys open />), "details")).toHaveProperty("open");
    expect(
      attrs(await renderToString(() => <Keys open={false} defaultOpen />), "details"),
    ).not.toHaveProperty("open");
  });

  it("disables the trigger: aria-disabled and out of the tab order", async () => {
    const summary = attrs(await renderToString(() => <Keys disabled />), "summary");
    expect(summary).toMatchObject({ "aria-disabled": "true", tabindex: "-1" });
  });

  it("refuses parts outside the root", async () => {
    await expect(renderToString(() => <Collapsible.Panel />)).rejects.toThrow(
      "Collapsible parts must be inside <Collapsible.Root>.",
    );
  });
});
