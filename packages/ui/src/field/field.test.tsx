// Server HTML of Field, Form, Input and Fieldset (TASK-365): native controls wired by the field
// (`for`, `id`, `name`, `aria-describedby`, `aria-invalid`), and the Form's server errors in the
// HTML, which is all a page without JavaScript gets. The browser behaviour (Field's script,
// timing, focus, axe) is checked by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Fieldset } from "../fieldset/fieldset.tsx";
import { Form } from "../form/form.tsx";
import { Input } from "../input/input.tsx";
import { attrs } from "../test/html.ts";
import { Field } from "./field.tsx";

function Email(props: { errors?: object; invalid?: boolean }) {
  return (
    <Form method="post" errors={props.errors}>
      <Field.Root name="email" invalid={props.invalid} validationMode="onBlur" class="field">
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" required defaultValue="ada@example.com" />
        <Field.Description>We never share it.</Field.Description>
        <Field.Error />
        <Field.Error match="valueMissing">Enter your email.</Field.Error>
        <Field.Error match>Always shown.</Field.Error>
      </Field.Root>
    </Form>
  );
}

function Checked(props: { errors?: object }) {
  return (
    <Form method="post" errors={props.errors}>
      <Field.Root name="email">
        <Field.Control type="email" />
        <Field.Validity>
          {(state) => (
            <p>
              valid: {String(state.validity.valid)}, error: {state.error || "none"}, errors:{" "}
              {state.errors.length}
            </p>
          )}
        </Field.Validity>
      </Field.Root>
    </Form>
  );
}

describe("Field on the server", () => {
  it("wires the label to the control, names it, and keeps the errors hidden", async () => {
    const html = await renderToString(() => <Email />);
    const root = attrs(html, "lu-field");
    const control = attrs(html, "input");
    expect(root).toMatchObject({ class: "field", "validation-mode": "onBlur" });
    expect(attrs(html, "label")).toMatchObject({ id: `${root.id}-label`, for: control.id });
    expect(control).toMatchObject({
      id: `${root.id}-control`,
      name: "email",
      type: "email",
      required: "",
      value: "ada@example.com",
    });
    expect(control).not.toHaveProperty("aria-invalid");
    const outputs = (id: string) => attrs(html, "output", (a) => a.id === id);
    expect(outputs(`${root.id}-error`)).toMatchObject({ for: control.id, hidden: "" });
    expect(outputs(`${root.id}-error-valueMissing`)).toHaveProperty("hidden");
    expect(outputs(`${root.id}-error-valueMissing`)).not.toHaveProperty("for");
    expect(outputs(`${root.id}-error-always`)).not.toHaveProperty("hidden");
  });

  it("shows the Form's server error for the field's name, linked and marked invalid", async () => {
    const html = await renderToString(() => <Email errors={{ email: "That email is taken." }} />);
    const root = attrs(html, "lu-field");
    const control = attrs(html, "input");
    expect(control).toMatchObject({
      "aria-invalid": "true",
      "aria-describedby": `${root.id}-error`,
    });
    const error = attrs(html, "output", (a) => a.id === `${root.id}-error`);
    expect(error).not.toHaveProperty("hidden");
    expect(html).toContain(">That email is taken.</output>");
    // A message for another field changes nothing here.
    const other = await renderToString(() => <Email errors={{ name: ["Required."] }} />);
    expect(attrs(other, "input")).not.toHaveProperty("aria-invalid");
  });

  it("renders Field.Validity unchecked, or with the server's error", async () => {
    expect(await renderToString(() => <Checked />)).toMatch(
      /valid: (<!--[^>]*-->)?null(<!--[^>]*-->)?, error: (<!--[^>]*-->)?none/,
    );
    const html = await renderToString(() => (
      <Checked errors={{ email: ["Taken.", "Too long."] }} />
    ));
    expect(html.replace(/<!--[^>]*-->/g, "")).toContain(
      "valid: false, error: Taken. Too long., errors: 2",
    );
  });

  it("takes `invalid` like a server error, and several messages", async () => {
    const html = await renderToString(() => <Email invalid />);
    expect(attrs(html, "input")).toHaveProperty("aria-invalid", "true");
    const many = await renderToString(() => <Email errors={{ email: ["One.", "Two."] }} />);
    expect(many).toContain(">One. Two.</output>");
  });

  it("links a description rendered before the control", async () => {
    const html = await renderToString(() => (
      <Field.Root name="q">
        <Field.Description>Search titles.</Field.Description>
        <Input aria-label="Search" />
      </Field.Root>
    ));
    const root = attrs(html, "lu-field");
    expect(attrs(html, "input")).toMatchObject({
      "aria-describedby": `${root.id}-description`,
      name: "q",
    });
  });
});

describe("Input, Fieldset and Form", () => {
  it("renders native elements with their props, an Input outside a field included", async () => {
    const html = await renderToString(() => (
      <Form method="post" action="?/save" class="form">
        <Fieldset.Root disabled class="set">
          <Fieldset.Legend>Address</Fieldset.Legend>
          <Input name="street" placeholder="Street" value="Main" />
        </Fieldset.Root>
      </Form>
    ));
    expect(attrs(html, "form")).toEqual({ method: "post", action: "?/save", class: "form" });
    expect(attrs(html, "fieldset")).toEqual({ disabled: "", class: "set" });
    expect(html).toContain("<legend>Address</legend>");
    expect(attrs(html, "input")).toEqual({ name: "street", placeholder: "Street", value: "Main" });
  });
});
