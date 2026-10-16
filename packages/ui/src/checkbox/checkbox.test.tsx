// Server HTML of Checkbox, CheckboxGroup, RadioGroup and Switch (TASK-366 to TASK-368): native
// inputs that toggle, submit and reset without JavaScript, the group's shared name and value, the
// parent checkbox's state, and the indeterminate state the script turns into the property.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { CheckboxGroup } from "../checkbox-group/checkbox-group.tsx";
import { Field } from "../field/field.tsx";
import { Fieldset } from "../fieldset/fieldset.tsx";
import { Radio, RadioGroup } from "../radio-group/radio-group.tsx";
import { Switch } from "../switch/switch.tsx";
import { attrs } from "../test/html.ts";
import { Checkbox } from "./checkbox.tsx";

const inputs = (html: string) =>
  [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => attrs(`<input${m[1]}>`, "input"));

describe("Checkbox and Switch on the server", () => {
  it("renders native checkboxes: checked, value, indeterminate, read-only", async () => {
    const html = await renderToString(() => (
      <>
        <Checkbox.Root name="terms" value="yes" defaultChecked required class="box" />
        <Checkbox.Root name="beta" indeterminate />
        <Checkbox.Root name="locked" checked readOnly />
      </>
    ));
    const [terms, beta, locked] = inputs(html);
    expect(terms).toEqual({
      name: "terms",
      required: "",
      class: "box",
      type: "checkbox",
      value: "yes",
      checked: "",
    });
    expect(beta).toMatchObject({ type: "checkbox", "data-indeterminate": "" });
    expect(beta).not.toHaveProperty("checked");
    expect(locked).toMatchObject({ checked: "", "aria-readonly": "true" });
  });

  it("writes uncheckedValue for the script, on a checkbox and a switch", async () => {
    const html = await renderToString(() => (
      <>
        <Checkbox.Root name="terms" uncheckedValue="no" />
        <Switch.Root name="wifi" uncheckedValue="off" />
      </>
    ));
    const [terms, wifi] = inputs(html);
    expect(terms).toMatchObject({ name: "terms", "data-unchecked-value": "no" });
    expect(wifi).toMatchObject({ name: "wifi", role: "switch", "data-unchecked-value": "off" });
  });

  it("renders a switch as a checkbox with the switch role", async () => {
    const html = await renderToString(() => <Switch.Root name="wifi" defaultChecked readOnly />);
    expect(attrs(html, "input")).toEqual({
      name: "wifi",
      type: "checkbox",
      role: "switch",
      checked: "",
      "aria-readonly": "true",
    });
  });

  it("takes the field's id, name and server error", async () => {
    const html = await renderToString(() => (
      <Field.Root name="terms" invalid>
        <Checkbox.Root required />
        <Field.Label>I accept</Field.Label>
      </Field.Root>
    ));
    const root = attrs(html, "lu-field");
    expect(attrs(html, "input")).toMatchObject({
      id: `${root.id}-control`,
      name: "terms",
      "aria-invalid": "true",
    });
    expect(attrs(html, "label")).toMatchObject({ for: `${root.id}-control` });
  });
});

/** A group of two with a parent, `value` checked. */
const group = (value: string[]) =>
  renderToString(() => (
    <CheckboxGroup name="toppings" defaultValue={value} allValues={["a", "b"]} disabled>
      <Fieldset.Legend>Toppings</Fieldset.Legend>
      <Checkbox.Root parent />
      <Checkbox.Root value="a" />
      <Checkbox.Root value="b" />
    </CheckboxGroup>
  ));

describe("CheckboxGroup on the server", () => {
  it("shares its name, checks its value, and gives the parent its state and no name", async () => {
    const some = await group(["a"]);
    expect(attrs(some, "fieldset")).toEqual({ disabled: "", role: "group" });
    const [parent, a, b] = inputs(some);
    // The parent names its checkboxes, whose ids come from the group's and their values (TASK-458).
    expect(a!.id).toMatch(/-a$/);
    expect(b!.id).toMatch(/-b$/);
    expect(parent).toEqual({
      type: "checkbox",
      "aria-controls": `${a!.id} ${b!.id}`,
      "data-indeterminate": "",
      "data-parent": "",
    });
    expect(a).toEqual({ type: "checkbox", id: a!.id, name: "toppings", value: "a", checked: "" });
    expect(b).toEqual({ type: "checkbox", id: b!.id, name: "toppings", value: "b" });
    const [all] = inputs(await group(["a", "b"]));
    expect(all).toMatchObject({ checked: "" });
    expect(all).not.toHaveProperty("data-indeterminate");
  });
});

describe("RadioGroup on the server", () => {
  it("renders a radiogroup fieldset of named radios, one checked, required and read-only", async () => {
    const html = await renderToString(() => (
      <RadioGroup name="size" defaultValue="m" required readOnly class="group">
        <Fieldset.Legend>Size</Fieldset.Legend>
        <Radio.Root value="s" />
        <Radio.Root value="m" />
        <Radio.Root value="l" disabled />
      </RadioGroup>
    ));
    expect(attrs(html, "fieldset")).toEqual({
      class: "group",
      role: "radiogroup",
      "aria-required": "true",
      "aria-readonly": "true",
    });
    const [s, m, l] = inputs(html);
    expect(s).toEqual({ required: "", type: "radio", name: "size", value: "s" });
    expect(m).toMatchObject({ value: "m", checked: "" });
    expect(l).toMatchObject({ value: "l", disabled: "" });
  });

  it("names its radios when no name is given, and takes a field's", async () => {
    const generated = inputs(
      await renderToString(() => (
        <RadioGroup>
          <Radio.Root value="a" />
        </RadioGroup>
      )),
    );
    expect(generated[0]!.name).toBeTruthy();
    const html = await renderToString(() => (
      <Field.Root name="plan" invalid>
        <RadioGroup>
          <Radio.Root value="a" />
        </RadioGroup>
        <Field.Error />
      </Field.Root>
    ));
    const root = attrs(html, "lu-field");
    expect(inputs(html)[0]).toMatchObject({ name: "plan" });
    expect(attrs(html, "fieldset")).toMatchObject({
      "aria-invalid": "true",
      "aria-describedby": `${root.id}-error`,
    });
  });
});
