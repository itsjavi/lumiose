// Form (decision-62, TASK-365): a native `<form>` that hands its fields the server's errors, after
// Base UI's Form. Submission is the platform's (or Lumiose's `submit()` in `onSubmit`): a form
// action's `fail(status, errors)` data, passed as `errors`, shows in each field's Error by the
// field's name, in server HTML and in islands. Field's client script shows the browser's
// constraint validation in the fields and focuses the first invalid one on a submit attempt.
import {
  FormContext,
  type FormErrors,
  type FormValues,
  type ValidationMode,
} from "../field/context.ts";

export type { FormValues };

/** A native `<form>`, with every native prop (`method`, `action`, `onSubmit`, …). */
export type FormProps = JSX.IntrinsicElements["form"] & {
  /**
   * The server's errors by field name: a message or several for each `Field.Root` `name`, such as
   * the data a form action passes to `fail()` (`actionData()`). A field's error goes away when its
   * value changes.
   */
  errors?: FormErrors | null;
  /** When the fields show their errors, unless a field sets its own. Default `"onSubmit"`. */
  validationMode?: ValidationMode;
  /**
   * The values to fill the controls with, by name, such as the `FormData` a form action passes back
   * with `fail()` after a failed submission, so the user does not type everything again. They
   * replace the controls' defaults; controls with a `value` (or `bind:`) keep theirs, and
   * passwords and files are never filled.
   */
  values?: FormValues | null;
};

/**
 * A native form whose fields show the server's errors (`errors`) and the browser's validation.
 *
 * @example
 * <Form method="post" action="?/signup" onSubmit={submit} errors={actionData<typeof actions>()}>
 *   <Field.Root name="email">…</Field.Root>
 * </Form>
 */
export function Form({ errors, validationMode, values, children, ...rest }: FormProps) {
  return (
    <FormContext
      value={{ errors: () => errors, validationMode: () => validationMode, values: () => values }}
    >
      <form {...rest}>{children}</form>
    </FormContext>
  );
}
