// Form `values` (TASK-430): after a failed submission, the controls render the values the action
// sent back as their defaults, by name, in server HTML. The browser side (JS on and off) runs in
// examples/ui-e2e (form.e2e.ts).
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Autocomplete } from "../autocomplete/autocomplete.tsx";
import { Checkbox } from "../checkbox/checkbox.tsx";
import { CheckboxGroup } from "../checkbox-group/checkbox-group.tsx";
import { Combobox } from "../combobox/combobox.tsx";
import { Field } from "../field/field.tsx";
import type { FormValues } from "../field/context.ts";
import { Fieldset } from "../fieldset/fieldset.tsx";
import { Input } from "../input/input.tsx";
import { NumberField } from "../number-field/number-field.tsx";
import { Radio, RadioGroup } from "../radio-group/radio-group.tsx";
import { Select } from "../select/select.tsx";
import { Slider } from "../slider/slider.tsx";
import { Switch } from "../switch/switch.tsx";
import { attrs } from "../test/html.ts";
import { Form } from "./form.tsx";

function Signup(props: { values?: FormValues }) {
  return (
    <Form method="post" values={props.values}>
      <Field.Root name="username">
        <Field.Control defaultValue="guest" />
      </Field.Root>
      <Input name="password" type="password" />
      <Input name="token" type="hidden" value="t0" />
      <Input name="note" defaultValue="none" disabled />
      <Checkbox.Root name="terms" />
      <Checkbox.Root name="news" defaultChecked />
      <Switch.Root name="dark" />
      <CheckboxGroup name="toppings" defaultValue={["cheese"]}>
        <Checkbox.Root value="cheese" />
        <Checkbox.Root value="olives" />
      </CheckboxGroup>
      <RadioGroup name="size" defaultValue="s">
        <Radio.Root value="s" />
        <Radio.Root value="m" />
      </RadioGroup>
      <Select.Root name="plan" defaultValue="free">
        <Select.Item value="free">Free</Select.Item>
        <Select.Item value="pro">Pro</Select.Item>
      </Select.Root>
      <NumberField.Root name="seats" defaultValue={1}>
        <NumberField.Input />
      </NumberField.Root>
      <Slider.Root name="volume" defaultValue={10}>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
      <Combobox.Root name="city">
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="lis">Lisbon</Combobox.Item>
          <Combobox.Item value="ber">Berlin</Combobox.Item>
        </Combobox.List>
      </Combobox.Root>
      <Autocomplete.Root name="topic">
        <Autocomplete.Input />
      </Autocomplete.Root>
      <Fieldset.Root disabled>
        <Checkbox.Root name="locked" defaultChecked />
      </Fieldset.Root>
    </Form>
  );
}

function submitted(): FormData {
  const form = new FormData();
  for (const [name, value] of [
    ["username", "ada"],
    ["password", "secret"],
    ["token", "forged"],
    ["terms", "on"],
    ["dark", "on"],
    ["toppings", "olives"],
    ["size", "m"],
    ["plan", "pro"],
    ["seats", "3"],
    ["volume", "70"],
    ["city", "ber"],
    ["topic", "signals"],
  ]) {
    form.append(name!, value!);
  }
  return form;
}

const input = (html: string, name: string, value?: string) =>
  attrs(html, "input", (a) => a.name === name && (value === undefined || a.value === value));

describe("Form values (TASK-430)", () => {
  it("fills the controls with a failed submission's values, by name", async () => {
    const html = await renderToString(() => <Signup values={submitted()} />);
    expect(input(html, "username").value).toBe("ada");
    // An unchecked checkbox is left out of a submission: absent means unchecked.
    expect(input(html, "terms")).toHaveProperty("checked");
    expect(input(html, "news")).not.toHaveProperty("checked");
    expect(input(html, "dark")).toHaveProperty("checked");
    expect(input(html, "toppings", "olives")).toHaveProperty("checked");
    expect(input(html, "toppings", "cheese")).not.toHaveProperty("checked");
    expect(input(html, "size", "m")).toHaveProperty("checked");
    expect(input(html, "size", "s")).not.toHaveProperty("checked");
    expect(attrs(html, "option", (a) => a.value === "pro")).toHaveProperty("selected");
    expect(input(html, "seats").value).toBe("3");
    expect(input(html, "volume").value).toBe("70");
    expect(attrs(html, "div", (a) => a["data-value"] === "ber")).toMatchObject({
      "aria-selected": "true",
    });
    expect(
      attrs(html, "input", (a) => a.role === "combobox" && a.value === "signals"),
    ).toBeTruthy();
  });

  it("never fills passwords, hidden inputs or disabled controls", async () => {
    const html = await renderToString(() => <Signup values={submitted()} />);
    expect(input(html, "password")).not.toHaveProperty("value");
    expect(input(html, "token").value).toBe("t0");
    expect(input(html, "note").value).toBe("none");
    expect(input(html, "locked")).toHaveProperty("checked");
  });

  it("never fills a password or hidden input whose type is not lowercase (TASK-472)", async () => {
    const html = await renderToString(() => (
      <Form method="post" values={{ pin: "1234", secret: "s3cret", token: "forged" }}>
        <Input name="pin" type={"PASSWORD" as "password"} />
        <Input name="secret" type={" Password " as "password"} />
        <Input name="token" type={"Hidden" as "hidden"} defaultValue="t0" />
      </Form>
    ));
    expect(input(html, "pin")).not.toHaveProperty("value");
    expect(input(html, "secret")).not.toHaveProperty("value");
    expect(input(html, "token").value).toBe("t0");
  });

  it("takes values by name as an object, and keeps the defaults without values", async () => {
    const html = await renderToString(() => (
      <Signup values={{ username: "linus", toppings: ["cheese", "olives"] }} />
    ));
    expect(input(html, "username").value).toBe("linus");
    expect(input(html, "toppings", "olives")).toHaveProperty("checked");
    const plain = await renderToString(() => <Signup />);
    expect(input(plain, "username").value).toBe("guest");
    expect(input(plain, "news")).toHaveProperty("checked");
    expect(input(plain, "size", "s")).toHaveProperty("checked");
  });
});
