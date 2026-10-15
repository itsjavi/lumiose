// Select (decision-62, TASK-358): a native `<select>`, the customizable select where the browser has
// it (`appearance: base-select`, Chrome 135, Safari 27) and the classic one elsewhere. The platform
// already does everything Base UI's Select does around the value: the combobox role, the keyboard
// and typeahead (on the closed control too), the top-layer picker anchored to the control, forms
// (`name`, `required`, autofill, reset, a disabled fieldset) and the mobile pickers. So Select
// ships no script: it works in server HTML, with no JavaScript, and in islands, where `value` drives
// the control when it changes and its `change` event reports back through `onValueChange`. Where
// customizable select is supported, `Select.Trigger` and `Select.Value` style the button and show
// the selected option's content, and options may hold more than text. TASK-358 records why it is
// native rather than the listbox pattern.
import { createContext, effect, ref, untrack, useContext } from "lumiose";
import { fieldProps, useField } from "../field/context.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Customizable select's copy of the selected option's content, inside its `<button>`. */
      selectedcontent: JSX.HTMLProps<HTMLElement>;
    }
  }
}

/**
 * The `<select>` props Root passes through, without the brand of intrinsic elements' props, so that
 * `bind:value` applies to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.IntrinsicElements["select"] as K extends string ? K : never
  ]: JSX.IntrinsicElements["select"][K];
};

/**
 * `Select.Root` renders the `<select>`, with the props it is given (`name`, `required`,
 * `disabled`, `autocomplete`, `form`, `class`, `aria-*`, events). `bind:value={signal}` stands in
 * for `value` and `onValueChange`. Label it with a `<label for>` and an `id`, or `aria-label`.
 */
export interface SelectRootProps extends Omit<
  ElementProps,
  "value" | "bind:value" | "multiple" | "size"
> {
  /**
   * Selects the option with this value when it changes. Pair it with `onValueChange` to keep a
   * signal in sync; leave both out and the select keeps its own state.
   */
  value?: string;
  /** The option selected at first, when `value` is left out. Default: the first option. */
  defaultValue?: string;
  /** Called after the user selects another option, with its value. */
  onValueChange?: (value: string) => void;
  /** `Trigger` (first, optional), then the `Item`s, `Group`s and `Separator`s. */
  children?: JSX.Element;
}

/**
 * The `<button>` customizable select renders as the control, holding `Select.Value` and anything
 * else (an icon). It must be the select's first child. Browsers without customizable select show
 * their own control instead.
 */
export type SelectTriggerProps = Omit<JSX.IntrinsicElements["button"], "type">;

/** `<selectedcontent>`: a copy of the selected option's content, inside the `Trigger`. */
export type SelectValueProps = Omit<JSX.IntrinsicElements["selectedcontent"], "children">;

/** An `<option>`. */
export type SelectItemProps = Omit<JSX.IntrinsicElements["option"], "value" | "selected"> & {
  /** The value the select takes, and submits, when the option is selected. */
  value: string;
  /** The option cannot be selected. */
  disabled?: boolean;
};

/** An `<optgroup>` of options. */
export type SelectGroupProps = JSX.IntrinsicElements["optgroup"] & {
  /** The group's name, shown above its options. */
  label: string;
};

/** An `<hr>` between options or groups. */
export type SelectSeparatorProps = JSX.IntrinsicElements["hr"];

const SelectContext = createContext<{ initial: string | undefined }>();

function Root({ value, defaultValue, onValueChange, children, ...rest }: SelectRootProps) {
  const select = ref<HTMLSelectElement>();
  const context = { initial: untrack(() => value ?? defaultValue) };
  // The prop drives the control when it changes, once its options are in; `change` reports back,
  // so a signal written by `onValueChange` sees the same value again and nothing loops.
  effect(() => {
    const element = select();
    const wanted = value;
    if (element?.isConnected && wanted !== undefined && element.value !== wanted) {
      element.value = wanted;
    }
  });
  // Inside a Field: the field's id, name and ARIA references (TASK-365).
  const field = useField();
  return (
    <SelectContext value={context}>
      <select
        {...rest}
        {...fieldProps(field, rest)}
        ref={(element: HTMLSelectElement) => {
          select(element);
          rest.ref?.(element);
        }}
        on:change={(event: Event) =>
          onValueChange?.((event.currentTarget as HTMLSelectElement).value)
        }
      >
        {children}
      </select>
    </SelectContext>
  );
}

function Trigger({ children, ...rest }: SelectTriggerProps) {
  return (
    <button {...rest} type="button">
      {children}
    </button>
  );
}

function Value(props: SelectValueProps) {
  return <selectedcontent {...props} />;
}

function Item({ children, value, ...rest }: SelectItemProps) {
  const select = useContext(SelectContext);
  if (!select) throw new Error("Select parts must be inside <Select.Root>.");
  return (
    <option {...rest} value={value} selected={select.initial === value || undefined}>
      {children}
    </option>
  );
}

function Group({ children, ...rest }: SelectGroupProps) {
  return <optgroup {...rest}>{children}</optgroup>;
}

function Separator(props: SelectSeparatorProps) {
  return <hr {...props} />;
}

/**
 * A native select: pick one value from a list. It works with no JavaScript and submits with its
 * form. Where the browser has customizable select (`appearance: base-select`), `Trigger` and
 * `Value` shape the button and options may hold more than text. Unstyled: style it through `class`,
 * `:open`, `::picker(select)`, `option:checked` and `option::checkmark`.
 *
 * @example
 * <label for="fruit">Fruit</label>
 * <Select.Root id="fruit" name="fruit" bind:value={fruit}>
 *   <Select.Trigger>
 *     <Select.Value />
 *   </Select.Trigger>
 *   <Select.Item value="apple">Apple</Select.Item>
 *   <Select.Item value="pear">Pear</Select.Item>
 * </Select.Root>
 */
export const Select = { Root, Trigger, Value, Item, Group, Separator };
