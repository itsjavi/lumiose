// The form controls' prop types (TASK-365 to TASK-368). Type-level: `pnpm typecheck` checks the JSX
// below and its `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is
// never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Checkbox } from "../checkbox/checkbox.tsx";
import { CheckboxGroup } from "../checkbox-group/checkbox-group.tsx";
import { Fieldset } from "../fieldset/fieldset.tsx";
import { Form } from "../form/form.tsx";
import { Input } from "../input/input.tsx";
import { Radio, RadioGroup } from "../radio-group/radio-group.tsx";
import { Switch } from "../switch/switch.tsx";
import { Field } from "./field.tsx";

interface Errors {
  title?: string;
}

export function Typed(props: { errors?: Errors }) {
  const text = signal("");
  const on = signal(false);
  const many = signal<string[]>([]);
  const one = signal("a");
  return (
    <>
      {/* bind: stands in for a prop and its onXChange (decision-62, TASK-360). */}
      <Form method="post" errors={props.errors} validationMode="onBlur">
        <Field.Root
          name="title"
          validationMode="onChange"
          validate={(value) => (value ? null : "No")}
        >
          <Field.Label>Title</Field.Label>
          <Field.Control bind:value={text} required minlength={2} />
          <Field.Description>Short.</Field.Description>
          <Field.Error />
          <Field.Error match="tooShort">Longer, please.</Field.Error>
          <Field.Error match>Always.</Field.Error>
        </Field.Root>
        <Field.Root
          name="handle"
          validationDebounceTime={300}
          validate={async (value) => (value === "admin" ? "Taken." : null)}
        >
          <Field.Control />
          <Field.Validity>
            {(state) => (state.validating ? "…" : String(state.validity.valid ?? state.error))}
          </Field.Validity>
        </Field.Root>
        <Input value={text()} onValueChange={(next: string) => text.set(next)} type="search" />
        <Fieldset.Root disabled>
          <Fieldset.Legend>Options</Fieldset.Legend>
          <Checkbox.Root bind:checked={on} indeterminate readOnly value="x" />
          <Switch.Root bind:checked={on} name="wifi" uncheckedValue="off" />
          <Checkbox.Root name="terms" uncheckedValue="no" />
        </Fieldset.Root>
        <CheckboxGroup bind:value={many} allValues={["a", "b"]} name="letters">
          <Checkbox.Root parent />
          <Checkbox.Root value="a" />
        </CheckboxGroup>
        <RadioGroup bind:value={one} name="pick" required readOnly>
          <Radio.Root value="a" />
        </RadioGroup>
      </Form>
      {/* @ts-expect-error: bind:checked takes a boolean signal */}
      <Checkbox.Root bind:checked={text} />
      {/* @ts-expect-error: bind:value takes a string[] signal */}
      <CheckboxGroup bind:value={one} />
      {/* @ts-expect-error: bind:value takes a string signal */}
      <RadioGroup bind:value={many} />
      {/* @ts-expect-error: a radio needs its value */}
      <Radio.Root />
      {/* @ts-expect-error: match is a ValidityState key */}
      <Field.Error match="tooLoud" />
      {/* @ts-expect-error: validationMode is one of Base UI's */}
      <Field.Root validationMode="onType" />
      {/* @ts-expect-error: Validity's child is a function of the state */}
      <Field.Validity>Valid</Field.Validity>
      {/* @ts-expect-error: a switch's role is its own */}
      <Switch.Root role="checkbox" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
