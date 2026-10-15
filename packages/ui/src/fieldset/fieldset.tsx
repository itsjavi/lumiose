// Fieldset (decision-62, TASK-365): a native `<fieldset>` and `<legend>`, after Base UI's
// Fieldset. The platform groups the controls, names the group by its legend and disables every
// control inside a disabled fieldset, in server HTML and without JavaScript; no script, no CSS.

/** `Fieldset.Root` renders a `<fieldset>`; `disabled` disables every control inside it. */
export type FieldsetRootProps = JSX.IntrinsicElements["fieldset"];

/** The `<legend>` that names the fieldset; it must be the fieldset's first child. */
export type FieldsetLegendProps = JSX.IntrinsicElements["legend"];

function Root({ children, ...rest }: FieldsetRootProps) {
  return <fieldset {...rest}>{children}</fieldset>;
}

function Legend({ children, ...rest }: FieldsetLegendProps) {
  return <legend {...rest}>{children}</legend>;
}

/**
 * A group of related fields with a caption: a native `<fieldset>` and `<legend>`. Also the label
 * of a `CheckboxGroup` or a `RadioGroup` (which render a fieldset themselves): put a
 * `Fieldset.Legend` first inside them.
 *
 * @example
 * <Fieldset.Root>
 *   <Fieldset.Legend>Shipping address</Fieldset.Legend>
 *   …fields…
 * </Fieldset.Root>
 */
export const Fieldset = { Root, Legend };
