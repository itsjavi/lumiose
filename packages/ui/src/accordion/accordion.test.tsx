// Server HTML of Accordion (TASK-370): native <details> items in one exclusive group (or none),
// headings inside the triggers, regions labelled by them, before `<lu-accordion>`'s script runs.
// Behaviour in a browser is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Accordion } from "./accordion.tsx";

function Faq(props: {
  multiple?: boolean;
  value?: string[];
  defaultValue?: string[];
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
  loopFocus?: boolean;
}) {
  return (
    <Accordion.Root
      class="faq"
      multiple={props.multiple}
      value={props.value}
      defaultValue={props.defaultValue}
      disabled={props.disabled}
      orientation={props.orientation}
      loopFocus={props.loopFocus}
    >
      <Accordion.Item value="shipping">
        <Accordion.Header class="heading">
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Two days.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="returns" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Returns</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>30 days.</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

const items = (html: string) =>
  [...html.matchAll(/<details\b([^>]*)>/g)].map((match) => attrs(match[0], "details"));

describe("Accordion on the server", () => {
  it("renders one exclusive group of closed items, with headings and labelled regions", async () => {
    const html = await renderToString(() => <Faq />);
    expect(attrs(html, "lu-accordion").class).toBe("faq");
    const [first, second] = items(html);
    expect(first!.name).toBeTruthy();
    expect(second!.name).toBe(first!.name);
    expect(first).not.toHaveProperty("open");
    expect(html).toMatch(/<summary[^>]*><h3 class="heading">Shipping<\/h3><\/summary>/);
    const summary = attrs(html, "summary");
    const panel = attrs(html, "div", (a) => a.id === summary["aria-controls"]);
    expect(panel).toMatchObject({ role: "region", "aria-labelledby": summary.id });
  });

  it("opens the first value in a single accordion, every value when multiple", async () => {
    let [first, second] = items(
      await renderToString(() => <Faq defaultValue={["returns", "shipping"]} />),
    );
    expect(first).not.toHaveProperty("open");
    expect(second).toHaveProperty("open");
    [first, second] = items(
      await renderToString(() => <Faq multiple value={["returns", "shipping"]} />),
    );
    expect(first).toHaveProperty("open");
    expect(second).toHaveProperty("open");
    expect(first).not.toHaveProperty("name");
  });

  it("disables items, and orients and stops the keys through data attributes", async () => {
    let html = await renderToString(() => <Faq />);
    const returns = attrs(html, "summary", (a) => a.tabindex === "-1");
    expect(returns["aria-disabled"]).toBe("true");
    html = await renderToString(() => <Faq disabled orientation="horizontal" loopFocus={false} />);
    expect(attrs(html, "lu-accordion")).toMatchObject({
      "data-orientation": "horizontal",
      "data-loop-focus": "false",
    });
    expect([...html.matchAll(/aria-disabled="true"/g)]).toHaveLength(2);
  });

  it("refuses items outside the root and parts outside an item", async () => {
    await expect(renderToString(() => <Accordion.Item />)).rejects.toThrow(
      "Accordion parts must be inside <Accordion.Root>.",
    );
    await expect(
      renderToString(() => (
        <Accordion.Root>
          <Accordion.Panel />
        </Accordion.Root>
      )),
    ).rejects.toThrow("Accordion parts must be inside an <Accordion.Item>.");
  });
});
