// Server HTML of Autocomplete (TASK-377) and of Combobox and Autocomplete in a Field (TASK-404):
// a free-text `<lu-combobox>` whose input has the name and the text, the completion it announces,
// and the field's id, name and ARIA references on the input.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Combobox } from "../combobox/combobox.tsx";
import { Field } from "../field/field.tsx";
import { attrs } from "../test/html.ts";
import { Autocomplete } from "./autocomplete.tsx";

describe("Autocomplete on the server", () => {
  it("renders a free-text combobox whose input has the name and the text", async () => {
    const html = await renderToString(() => (
      <Autocomplete.Root name="tag" defaultValue="lumi" required openOnInputClick>
        <Autocomplete.Label>Tag</Autocomplete.Label>
        <Autocomplete.Input placeholder="Add a tag" />
        <Autocomplete.Clear aria-label="Clear" />
        <Autocomplete.List>
          <Autocomplete.Item value="lumiose">lumiose</Autocomplete.Item>
          <Autocomplete.Item value="lumen">lumen</Autocomplete.Item>
        </Autocomplete.List>
      </Autocomplete.Root>
    ));
    const root = attrs(html, "lu-combobox");
    expect(root).toEqual({ id: root.id, free: "", "open-on-input-click": "" });
    expect(attrs(html, "input")).toEqual({
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "Add a tag",
      name: "tag",
      required: "",
      value: "lumi",
      type: "text",
      id: `${root.id}-input`,
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": `${root.id}-list`,
      style: expect.stringContaining("anchor-name"),
    });
    expect(attrs(html, "label")).toMatchObject({ for: `${root.id}-input` });
    // There is text to clear.
    expect(attrs(html, "button")).not.toHaveProperty("hidden");
    // An Autocomplete selects nothing: no `aria-selected` on its options (TASK-454, L32).
    const option = attrs(html, "div", (a) => a.role === "option");
    expect(option).toMatchObject({ "data-value": "lumiose" });
    expect(option).not.toHaveProperty("aria-selected");
  });

  it("announces inline completion, and leaves filtering to the page without it", async () => {
    const both = await renderToString(() => (
      <Autocomplete.Root mode="both" filter="startsWith">
        <Autocomplete.Input aria-label="City" />
        <Autocomplete.List />
      </Autocomplete.Root>
    ));
    expect(attrs(both, "lu-combobox")).toMatchObject({ inline: "", filter: "startsWith" });
    expect(attrs(both, "input")["aria-autocomplete"]).toBe("both");
    const none = await renderToString(() => (
      <Autocomplete.Root mode="none">
        <Autocomplete.Input aria-label="City" />
        <Autocomplete.List />
      </Autocomplete.Root>
    ));
    expect(attrs(none, "lu-combobox")).toMatchObject({ filter: "none" });
    expect(attrs(none, "lu-combobox")).not.toHaveProperty("inline");
    expect(attrs(none, "input")["aria-autocomplete"]).toBe("none");
  });
});

describe("Combobox and Autocomplete in a Field", () => {
  it("give the input the field's id and ARIA references, and the field's name", async () => {
    const html = await renderToString(() => (
      <>
        <Field.Root name="city" invalid>
          <Field.Label>City</Field.Label>
          <Field.Description>Where you live.</Field.Description>
          <Combobox.Root>
            <Combobox.Input />
            <Combobox.List />
          </Combobox.Root>
        </Field.Root>
        <Field.Root name="search" disabled>
          <Field.Label>Search</Field.Label>
          <Autocomplete.Root>
            <Autocomplete.Input />
            <Autocomplete.List />
          </Autocomplete.Root>
        </Field.Root>
      </>
    ));
    const [city, search] = [...html.matchAll(/<lu-field\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(attrs(html, "lu-combobox")).toMatchObject({ name: "city" });
    expect(attrs(html, "input")).toMatchObject({
      id: `${city}-control`,
      "aria-describedby": `${city}-description ${city}-error`,
      "aria-invalid": "true",
    });
    expect(attrs(html, "label")).toMatchObject({ for: `${city}-control` });
    expect(attrs(html, "input", (a) => a.name === "search")).toMatchObject({
      id: `${search}-control`,
      disabled: "",
    });
    expect(attrs(html, "lu-combobox", (a) => "free" in a)).toMatchObject({ disabled: "" });
  });
});
