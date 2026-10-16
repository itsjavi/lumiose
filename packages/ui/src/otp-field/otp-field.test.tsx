// Server HTML of OTP Field (TASK-376): one native input with the code's length, pattern, keyboard
// and autofill hints, visual slots with the server's characters, and Field's wiring.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Field } from "../field/field.tsx";
import { attrs } from "../test/html.ts";
import { OTPField } from "./otp-field.tsx";

const slots = (html: string) =>
  [...html.matchAll(/<div\b([^>]*data-slot[^>]*)>([^<]*)</g)].map((m) => m[2]);

describe("OTPField on the server", () => {
  it("renders one input for the whole code, and a slot per character", async () => {
    const html = await renderToString(() => (
      <OTPField.Root length={4} name="code" defaultValue="12" required autoSubmit>
        <OTPField.Input aria-label="Verification code" />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Separator />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
    ));
    const root = attrs(html, "lu-otp-field");
    // Digits read left to right, in a right-to-left page too.
    expect(root).toEqual({
      dir: "ltr",
      length: "4",
      "validation-type": "numeric",
      "auto-submit": "",
    });
    expect(attrs(html, "input")).toEqual({
      spellcheck: "false",
      autocapitalize: "off",
      "aria-label": "Verification code",
      type: "text",
      id: expect.stringMatching(/-input$/),
      name: "code",
      value: "12",
      inputmode: "numeric",
      autocomplete: "one-time-code",
      maxlength: "4",
      minlength: "4",
      pattern: "\\p{Nd}{4}",
      required: "",
    });
    expect(slots(html)).toEqual(["1", "2", "", ""]);
    expect(attrs(html, "div", (a) => "data-slot" in a)).toMatchObject({
      "aria-hidden": "true",
      "data-filled": "",
    });
    expect(attrs(html, "div", (a) => "data-orientation" in a)).toEqual({
      "aria-hidden": "true",
      "data-orientation": "horizontal",
    });
  });

  it("masks the slots, and follows the validation type", async () => {
    const html = await renderToString(() => (
      <OTPField.Root length={3} defaultValue="AB" validationType="alphanumeric" mask>
        <OTPField.Input aria-label="Code" />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
    ));
    expect(attrs(html, "lu-otp-field")).toMatchObject({ mask: "" });
    // Letters follow the page's direction.
    expect(attrs(html, "lu-otp-field")).not.toHaveProperty("dir");
    expect(attrs(html, "input")).toMatchObject({
      inputmode: "text",
      pattern: "[\\p{L}\\p{Nd}]{3}",
    });
    expect(slots(html)).toEqual(["•", "•", ""]);
  });

  it("takes the field's id, name, description and state", async () => {
    const html = await renderToString(() => (
      <Field.Root name="otp" invalid>
        <Field.Label>Code</Field.Label>
        <Field.Description>Sent by text message.</Field.Description>
        <OTPField.Root length={6} readOnly>
          <OTPField.Input />
        </OTPField.Root>
      </Field.Root>
    ));
    const field = attrs(html, "lu-field");
    expect(attrs(html, "input")).toMatchObject({
      id: `${field.id}-control`,
      name: "otp",
      "aria-describedby": `${field.id}-description ${field.id}-error`,
      "aria-invalid": "true",
      readonly: "",
    });
  });
});
