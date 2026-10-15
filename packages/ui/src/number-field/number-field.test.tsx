// Server HTML of Number Field (TASK-375) and its number parsing: a native number input without
// `format`, a formatted spinbutton and a hidden input with it, the buttons disabled at the ends of
// the range, and Field's wiring.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Field } from "../field/field.tsx";
import { attrs } from "../test/html.ts";
import { formatNumber, formatter, parseNumber } from "./format.ts";
import { NumberField } from "./number-field.tsx";

const inputs = (html: string) =>
  [...html.matchAll(/<input\b([^>]*)>/g)].map((m) => attrs(`<input${m[1]}>`, "input"));
const buttons = (html: string) =>
  [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => attrs(`<button${m[1]}>`, "button"));

describe("NumberField on the server", () => {
  it("renders a native number input with its range, and buttons disabled at the ends", async () => {
    const html = await renderToString(() => (
      <NumberField.Root name="quantity" defaultValue={99} min={1} max={99} largeStep={5}>
        <NumberField.Group>
          <NumberField.Decrement>−</NumberField.Decrement>
          <NumberField.Input aria-label="Quantity" />
          <NumberField.Increment>+</NumberField.Increment>
        </NumberField.Group>
      </NumberField.Root>
    ));
    const root = attrs(html, "lu-number-field");
    expect(root).toMatchObject({ min: "1", max: "99", "large-step": "5" });
    const [hidden, input] = inputs(html);
    expect(hidden).toEqual({ type: "hidden" });
    expect(input).toEqual({
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": "Quantity",
      min: "1",
      max: "99",
      type: "number",
      inputmode: "decimal",
      id: `${root.id}-input`,
      name: "quantity",
      value: "99",
    });
    const [down, up] = buttons(html);
    expect(down).toEqual({
      type: "button",
      tabindex: "-1",
      "aria-label": "Decrease",
      "data-action": "decrement",
      "aria-controls": input!.id,
    });
    expect(up).toMatchObject({ "data-action": "increment", disabled: "" });
  });

  it("formats with Intl: a text spinbutton, and the number in a hidden input", async () => {
    const html = await renderToString(() => (
      <NumberField.Root
        id="price"
        name="price"
        defaultValue={1234.5}
        min={0}
        format={{ style: "currency", currency: "EUR" }}
        locale="de-DE"
        allowWheelScrub
      >
        <NumberField.ScrubArea direction="vertical" pixelSensitivity={4}>
          <label for="price">Price</label>
        </NumberField.ScrubArea>
        <NumberField.Input />
      </NumberField.Root>
    ));
    expect(attrs(html, "lu-number-field")).toMatchObject({
      format: "{&quot;style&quot;:&quot;currency&quot;,&quot;currency&quot;:&quot;EUR&quot;}",
      locale: "de-DE",
      "allow-wheel-scrub": "",
    });
    const [hidden, input] = inputs(html);
    expect(hidden).toEqual({ type: "hidden", value: "1234.5" });
    expect(input).toMatchObject({
      role: "spinbutton",
      "aria-valuenow": "1234.5",
      "aria-valuemin": "0",
      "aria-valuetext": "1.234,50\u00a0€",
      type: "text",
      id: "price",
      name: "price",
      value: "1.234,50\u00a0€",
    });
    expect(input).not.toHaveProperty("min");
    expect(attrs(html, "span")).toEqual({
      "data-scrub": "",
      "data-direction": "vertical",
      "data-pixel-sensitivity": "4",
    });
  });

  it("takes the field's id, name, description and state", async () => {
    const html = await renderToString(() => (
      <Field.Root name="age" invalid>
        <Field.Label>Age</Field.Label>
        <Field.Description>In years.</Field.Description>
        <NumberField.Root required readOnly>
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      </Field.Root>
    ));
    const field = attrs(html, "lu-field");
    expect(inputs(html)[1]).toMatchObject({
      id: `${field.id}-control`,
      name: "age",
      "aria-describedby": `${field.id}-description ${field.id}-error`,
      "aria-invalid": "true",
      required: "",
      readonly: "",
    });
    expect(attrs(html, "label")).toMatchObject({ for: `${field.id}-control` });
    expect(buttons(html)[0]).toMatchObject({ disabled: "" });
  });
});

describe("parseNumber", () => {
  const en = formatter(undefined, "en-US");
  const de = formatter({ style: "currency", currency: "EUR" }, "de-DE");
  const percent = formatter({ style: "percent" }, "en-US");
  const arabic = formatter(undefined, "ar-EG");

  it("reads what the format writes, and plain numbers", () => {
    expect(parseNumber(formatNumber(1234.5, en), en)).toBe(1234.5);
    expect(parseNumber(formatNumber(-1234.5, de), de)).toBe(-1234.5);
    expect(parseNumber("1.234,5", de)).toBe(1234.5);
    expect(parseNumber("12,5 €", de)).toBe(12.5);
    expect(parseNumber("50 %", percent)).toBe(0.5);
    expect(parseNumber(formatNumber(42.5, arabic), arabic)).toBe(42.5);
    expect(parseNumber("(3)", en)).toBe(-3);
  });

  it("reads nothing as null and no digits as NaN", () => {
    expect(parseNumber("  ", en)).toBeNull();
    expect(parseNumber("abc", en)).toBeNaN();
  });
});
