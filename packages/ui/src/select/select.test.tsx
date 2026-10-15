// Server HTML of Select (TASK-358): a native `<select>` that works with no JavaScript, so the markup
// is the whole component: the options, the selection, the groups and customizable select's button.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Select } from "./select.tsx";

function Fruit(props: { value?: string; defaultValue?: string }) {
  return (
    <Select.Root
      id="fruit"
      name="fruit"
      required
      class="select"
      value={props.value}
      defaultValue={props.defaultValue}
    >
      <Select.Trigger class="trigger">
        <Select.Value />
      </Select.Trigger>
      <Select.Item value="apple">Apple</Select.Item>
      <Select.Separator />
      <Select.Group label="Citrus">
        <Select.Item value="lime" disabled>
          Lime
        </Select.Item>
        <Select.Item value="lemon">Lemon</Select.Item>
      </Select.Group>
    </Select.Root>
  );
}

describe("Select on the server", () => {
  it("renders a native select with customizable select's button first", async () => {
    const html = await renderToString(() => <Fruit />);
    expect(attrs(html, "select")).toMatchObject({
      id: "fruit",
      name: "fruit",
      required: "",
      class: "select",
    });
    expect(html).toMatch(
      /^<select[^>]*><button class="trigger" type="button"><selectedcontent><\/selectedcontent><\/button><option/,
    );
    expect(attrs(html, "optgroup")).toEqual({ label: "Citrus" });
    expect(attrs(html, "option", (a) => a.value === "lime")).toHaveProperty("disabled");
    expect(html).toContain("<hr>");
    // No selection: the browser selects the first option, as a native select does.
    expect(html).not.toMatch(/ selected[ =>]/);
  });

  it("selects `value`, else `defaultValue`", async () => {
    const byDefault = await renderToString(() => <Fruit defaultValue="lemon" />);
    expect(attrs(byDefault, "option", (a) => a.value === "lemon")).toHaveProperty("selected");
    const controlled = await renderToString(() => <Fruit value="apple" defaultValue="lemon" />);
    expect(attrs(controlled, "option", (a) => a.value === "apple")).toHaveProperty("selected");
    expect(attrs(controlled, "option", (a) => a.value === "lemon")).not.toHaveProperty("selected");
  });
});
