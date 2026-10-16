// Combobox (decision-62, TASK-358): an input that filters a list of options, after the APG combobox
// pattern with list autocomplete and manual selection, and Base UI's anatomy. Root renders
// `<lu-combobox>`, a light-DOM, form-associated element whose script (combobox.script.ts) owns the
// behaviour: the server HTML carries the roles, the wiring and the selection, and the element's DOM
// is the state from then on. The `value` and `open` props drive it when they change, and its
// `change` and `openchange` events report back through `onValueChange` and `onOpenChange`. The
// input shows the selected option's label; the form gets its value. Ported from Timeless's
// approach (https://timeless.build).
import {
  createContext,
  effect,
  isServer,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import type {
  ComboboxElement,
  ComboboxFilter,
  ComboboxOpenChangeDetail,
} from "./combobox.script.ts";
import comboboxScript from "./combobox.script.ts?client";
import { controlId, describedBy, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import { anchorName, placement, withStyle, type PlacementProps } from "../placement/placement.ts";
import { ComboboxContext, register, useCombobox, type ComboboxContextValue } from "./context.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Combobox's element, rendered by `Combobox.Root` and `Autocomplete.Root`: a form control
       * with no box. Properties `value` (an array with `multiple`), `open`, `name`, `required`,
       * `disabled`, `multiple`; attributes `filter`, and for an Autocomplete `free` (the input's
       * text is the value), `inline` (the arrows complete the text) and `open-on-input-click`;
       * events `change` and `openchange` (`detail.open`).
       */
      "lu-combobox": JSX.HTMLProps<ComboboxElement> & {
        name?: string;
        required?: boolean;
        disabled?: boolean;
        multiple?: boolean;
        filter?: ComboboxFilter;
        free?: boolean;
        inline?: boolean;
        "open-on-input-click"?: boolean;
        "auto-highlight"?: boolean;
        "keep-highlight"?: boolean;
        "submit-on-item-click"?: boolean;
        limit?: number;
      };
    }
  }
}

/** The value of a combobox: a string, or the selected strings with `multiple`. */
export type ComboboxValue<Multiple extends boolean | undefined> = Multiple extends true
  ? string[]
  : string;

/**
 * The element props Root passes to `<lu-combobox>` (`class`, `style`, `data-*`, events), without
 * the brand of intrinsic elements' props, so that `bind:value` and `bind:open` apply to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<ComboboxElement> as K extends string ? K : never
  ]: JSX.HTMLProps<ComboboxElement>[K];
};

/**
 * `Combobox.Root` renders `<lu-combobox>`, the form control around the other parts.
 * `bind:value={signal}` stands in for `value` and `onValueChange`, `bind:open` for `open` and
 * `onOpenChange`.
 */
export interface ComboboxRootProps<Multiple extends boolean | undefined = false> extends Omit<
  ElementProps,
  "children" | "onChange"
> {
  /**
   * Selects the option with this value (with `multiple`, these values) when it changes. Pair it
   * with `onValueChange` to keep a signal in sync; leave both out and the combobox keeps its own
   * state. `""` (or `[]`) selects nothing.
   */
  value?: ComboboxValue<Multiple>;
  /** The selection at first, when `value` is left out. */
  defaultValue?: ComboboxValue<Multiple>;
  /** Called after the user chooses, removes or clears a value, with the new value. */
  onValueChange?: (value: ComboboxValue<Multiple>) => void;
  /**
   * Opens (`true`) or closes (`false`) the popup when it changes, in the browser. Pair it with
   * `onOpenChange`; server HTML always starts closed.
   */
  open?: boolean;
  /** Called after the popup opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Several values can be selected: choosing an option toggles it, the popup stays open, and the
   * values show as `Combobox.Chips`. `value` is then an array.
   */
  multiple?: Multiple;
  /** The name the value is submitted under; with `multiple`, each value is its own entry. */
  name?: string;
  /** The form needs a value: the browser reports it empty, at the input, on submit. */
  required?: boolean;
  /** The combobox cannot be used: the input and the buttons are disabled. */
  disabled?: boolean;
  /**
   * How typing filters the options by their label: `"contains"` (default) or `"startsWith"`,
   * ignoring case and accents, or `"none"` to filter them yourself (async options).
   */
  filter?: ComboboxFilter;
  /** The other parts: `Label`, `Input`, the buttons, `Chips`, and the `List` or `Popup`. */
  children?: JSX.Element;
}

/** The `<label>` of the input. */
export type ComboboxLabelProps = JSX.IntrinsicElements["label"];

/**
 * The `<input role="combobox">` the user types in. It shows the selected option's label, filters
 * the options and keeps focus while the arrows move through them.
 */
export type ComboboxInputProps = Omit<JSX.IntrinsicElements["input"], "type" | "value">;

/**
 * A `<button>` that opens and closes the popup (`command="--toggle"`), out of the tab order: name
 * it with `aria-label` or its content.
 */
export type ComboboxTriggerProps = JSX.IntrinsicElements["button"];

/**
 * A `<button>` that clears the value and the text (`command="--clear"`), out of the tab order and
 * hidden while there is nothing to clear: name it with `aria-label` or its content.
 */
export type ComboboxClearProps = JSX.IntrinsicElements["button"];

/**
 * A `<div popover>` around the `List`, for an empty state, a status or anything else beside the
 * options. Without it, the `List` is the popup. Placed next to the input.
 */
export type ComboboxPopupProps = JSX.IntrinsicElements["div"] & PlacementProps;

/** The `<div role="listbox">` of options: the popup itself, unless it is inside a `Popup`. */
export type ComboboxListProps = JSX.IntrinsicElements["div"] & PlacementProps;

/** A `<div role="option">`. */
export type ComboboxItemProps = Omit<JSX.IntrinsicElements["div"], "value"> & {
  /** The value the combobox takes, and submits, when the option is chosen. */
  value: string;
  /** The text the input shows and typing matches, when the option's text content is not it. */
  label?: string;
  /** The option cannot be chosen, and the arrow keys skip it (`aria-disabled`). */
  disabled?: boolean;
};

/** A `<div role="group">` of options, named by its `GroupLabel`; hidden while none matches. */
export type ComboboxGroupProps = JSX.IntrinsicElements["div"];

/** A `<div role="presentation">` that names its group. */
export type ComboboxGroupLabelProps = JSX.IntrinsicElements["div"];

/**
 * A `<div role="status">` shown instead of the options when none matches the text; the popup stays
 * open to show it. Put it in a `Popup`, next to the `List`.
 */
export type ComboboxEmptyProps = JSX.IntrinsicElements["div"];

/**
 * A `<div role="status">` whose text changes are announced, for a loading or result-count
 * message. Put it in a `Popup`, next to the `List`.
 */
export type ComboboxStatusProps = JSX.IntrinsicElements["div"];

/**
 * The `<div role="list">` of selected values, with `multiple`: the script renders a chip for each
 * one, a `<span role="listitem">` with the label and a remove button.
 */
export type ComboboxChipsProps = Omit<JSX.IntrinsicElements["div"], "children"> & {
  /** The remove buttons' name, before the value's label. Default `"Remove"`. */
  removeLabel?: string;
};

const GroupContext = createContext<{ labelId: string; labels: Signal<number> }>();

const list = (value: string | readonly string[] | undefined): string[] =>
  value === undefined || value === "" ? [] : typeof value === "string" ? [value] : [...value];

/** An id fragment for a value: ids may not hold spaces. */
const fragment = (value: string) => encodeURIComponent(value).replaceAll("%", "_");

function Root<Multiple extends boolean | undefined = false>({
  value,
  defaultValue,
  onValueChange,
  open,
  onOpenChange,
  multiple,
  name,
  required,
  disabled,
  filter,
  children,
  ...rest
}: ComboboxRootProps<Multiple>) {
  // The behaviour, on the server HTML and in islands; the page loads it once (decision-63).
  comboboxScript();
  const id = useId();
  // Inside a Field: the field's id, name, state and ARIA references (TASK-404).
  const field = useField();
  const host = ref<ComboboxElement>();
  // A failed submission's values (a Form's `values`) replace the default (TASK-430).
  const sent = useFormValues(
    untrack(() => name ?? field?.name()),
    untrack(() => disabled),
  );
  const selected = signal<string[]>(
    untrack(() => (value === undefined && sent?.length ? sent : list(value ?? defaultValue))),
  );
  const context: ComboboxContextValue = {
    id,
    inputId: field ? controlId(field) : `${id}-input`,
    selected,
    multiple: () => multiple === true,
    disabled: () => disabled === true || field?.disabled() === true,
    required: () => required === true,
    labels: signal(0),
    popup: false,
  };

  // The props drive the element when they change; its events report back, so a signal written by
  // a callback sees the same value again and nothing loops.
  effect(() => {
    const element = host();
    const wanted = value;
    if (!element?.isConnected || wanted === undefined) return;
    element.value = wanted;
    selected.set(list(wanted));
  });
  effect(() => {
    const element = host();
    const wanted = open;
    if (element?.isConnected && wanted !== undefined) element.open = wanted;
  });
  // A form reset puts the selection back without a `change`: it is reported (TASK-435).
  onFormReset(
    host,
    () => host()!.value,
    (next) => {
      selected.set(list(next));
      onValueChange?.(next as ComboboxValue<Multiple>);
    },
  );

  return (
    <ComboboxContext value={context}>
      <lu-combobox
        {...rest}
        ref={host}
        id={id}
        name={name ?? field?.name()}
        required={required}
        disabled={context.disabled()}
        multiple={multiple}
        filter={filter}
        on:change={() => {
          const next = host()!.value;
          selected.set(list(next));
          onValueChange?.(next as ComboboxValue<Multiple>);
        }}
        on:openchange={(event: CustomEvent<ComboboxOpenChangeDetail>) =>
          onOpenChange?.(event.detail.open)
        }
      >
        {children}
      </lu-combobox>
    </ComboboxContext>
  );
}

// Each part spreads the caller's props first, so they override the defaults, and sets the wiring
// last, so the roles, ids, references and commands stay consistent between the parts.

function Label({ children, ...rest }: ComboboxLabelProps) {
  const combobox = useCombobox();
  register(combobox.labels);
  return (
    <label {...rest} id={`${combobox.id}-label`} for={combobox.inputId}>
      {children}
    </label>
  );
}

function Input({ style, ...rest }: ComboboxInputProps) {
  const combobox = useCombobox();
  const field = useField();
  // In an Autocomplete the input is the form control (name, required, its text); in a Combobox the
  // element is.
  const own = untrack(() => {
    const text = combobox.text;
    return text ? { name: text.name(), required: text.required(), value: text.initial } : {};
  });
  return (
    <input
      autocomplete="off"
      spellcheck={false}
      aria-describedby={field ? describedBy(field) : undefined}
      aria-invalid={field?.invalid() ? "true" : undefined}
      {...rest}
      {...own}
      type="text"
      id={combobox.inputId}
      role="combobox"
      aria-autocomplete={combobox.text?.autocomplete ?? "list"}
      // The element holds `required`, but has no role: the input tells assistive technology.
      aria-required={combobox.required?.() ? "true" : undefined}
      aria-expanded="false"
      aria-controls={`${combobox.id}-list`}
      disabled={combobox.disabled() || rest.disabled}
      style={withStyle(style, { "anchor-name": anchorName(combobox.id) })}
    />
  );
}

function Trigger({ children, ...rest }: ComboboxTriggerProps) {
  const combobox = useCombobox();
  return (
    <button
      type="button"
      tabindex={-1}
      {...rest}
      disabled={combobox.disabled() || rest.disabled}
      command="--toggle"
      commandfor={combobox.id}
    >
      {children}
    </button>
  );
}

function Clear({ children, ...rest }: ComboboxClearProps) {
  const combobox = useCombobox();
  // The script shows and hides it from then on.
  const empty = untrack(() =>
    combobox.text ? !combobox.text.initial : combobox.selected().length === 0,
  );
  return (
    <button
      type="button"
      tabindex={-1}
      hidden={empty}
      {...rest}
      disabled={combobox.disabled() || rest.disabled}
      command="--clear"
      commandfor={combobox.id}
    >
      {children}
    </button>
  );
}

function Popup({
  children,
  side,
  align,
  sideOffset,
  alignOffset,
  style,
  ...rest
}: ComboboxPopupProps) {
  const combobox = useCombobox();
  return (
    <ComboboxContext value={{ ...combobox, popup: true }}>
      <div
        {...rest}
        id={`${combobox.id}-popup`}
        popover="manual"
        {...placement(
          { side, align, sideOffset, alignOffset, style },
          combobox.id,
          "bottom",
          "start",
        )}
      >
        {children}
      </div>
    </ComboboxContext>
  );
}

function List({
  children,
  side,
  align,
  sideOffset,
  alignOffset,
  style,
  ...rest
}: ComboboxListProps) {
  const combobox = useCombobox();
  // The listbox is the popover unless a Popup holds it.
  const popover = combobox.popup
    ? { style }
    : {
        popover: "manual" as const,
        ...placement(
          { side, align, sideOffset, alignOffset, style },
          combobox.id,
          "bottom",
          "start",
        ),
      };
  return (
    <div
      aria-labelledby={combobox.labels() > 0 ? `${combobox.id}-label` : undefined}
      {...rest}
      {...popover}
      id={`${combobox.id}-list`}
      role="listbox"
      aria-multiselectable={combobox.multiple() || undefined}
    >
      {children}
    </div>
  );
}

function Item({ children, value, label, disabled, ...rest }: ComboboxItemProps) {
  const combobox = useCombobox();
  return (
    <div
      {...rest}
      id={`${combobox.id}-option-${fragment(value)}`}
      role="option"
      data-value={value}
      data-label={label}
      aria-selected={combobox.selected().includes(value)}
      aria-disabled={disabled || undefined}
    >
      {children}
    </div>
  );
}

function Group(props: ComboboxGroupProps) {
  useCombobox();
  const id = useId();
  const group = { labelId: `${id}-label`, labels: signal(0) };
  return (
    <GroupContext value={group}>
      <GroupElement {...props} group={group} />
    </GroupContext>
  );
}

/** The group's `<div>`, inside its context, labelled by its `GroupLabel` if any. */
function GroupElement({
  group,
  children,
  ...rest
}: ComboboxGroupProps & { group: { labelId: string; labels: Signal<number> } }) {
  // The server writes the attributes before it renders the children, so it renders them first to
  // know whether a GroupLabel exists. The browser claims the group before its children (hydration
  // needs that order) and updates the reference when the label registers.
  const content = isServer ? untrack(() => children) : undefined;
  return (
    <div aria-labelledby={group.labels() > 0 ? group.labelId : undefined} {...rest} role="group">
      {isServer ? content : children}
    </div>
  );
}

function GroupLabel({ children, ...rest }: ComboboxGroupLabelProps) {
  const group = useContext(GroupContext);
  if (!group) throw new Error("Combobox.GroupLabel must be inside <Combobox.Group>.");
  register(group.labels);
  return (
    <div role="presentation" {...rest} id={group.labelId}>
      {children}
    </div>
  );
}

function Empty({ children, ...rest }: ComboboxEmptyProps) {
  const combobox = useCombobox();
  // Shown by the script when no option matches.
  return (
    <div {...rest} id={`${combobox.id}-empty`} role="status" hidden>
      {children}
    </div>
  );
}

function Status({ children, ...rest }: ComboboxStatusProps) {
  useCombobox();
  return (
    <div {...rest} role="status">
      {children}
    </div>
  );
}

function Chips({ removeLabel, ...rest }: ComboboxChipsProps) {
  const combobox = useCombobox();
  // The script renders the chips: it knows the labels of the selected values.
  return <div {...rest} id={`${combobox.id}-chips`} role="list" data-remove-label={removeLabel} />;
}

/**
 * A text input that filters a list of options, for picking one value (or several, with
 * `multiple`) from many: the APG combobox pattern with list autocomplete, after Base UI's
 * Combobox. The input shows the option's label, the form gets its value. `<lu-combobox>`'s script
 * runs it, on server-rendered pages too. Unstyled: style the parts through `class` and
 * `[aria-expanded]`, `:popover-open`, `[aria-selected]`, `[aria-disabled]`, `[data-highlighted]`.
 *
 * @example
 * <Combobox.Root name="city" bind:value={city}>
 *   <Combobox.Label>City</Combobox.Label>
 *   <Combobox.Input placeholder="Search cities" />
 *   <Combobox.List>
 *     <Combobox.Item value="ber">Berlin</Combobox.Item>
 *     <Combobox.Item value="lis">Lisbon</Combobox.Item>
 *   </Combobox.List>
 * </Combobox.Root>
 */
export const Combobox = {
  Root,
  Label,
  Input,
  Trigger,
  Clear,
  Chips,
  Popup,
  List,
  Item,
  Group,
  GroupLabel,
  Empty,
  Status,
};
