// Autocomplete (decision-62, TASK-377): a text input with suggestions, after Base UI's Autocomplete
// and the APG combobox with list autocomplete. The text is the value: the input has the name and
// submits what is typed, and choosing a suggestion only fills it in. It is a Combobox in free mode:
// Root renders the same `<lu-combobox>` with `free` (combobox.script.ts), and the other parts are
// Combobox's, reading this Root's context. The `value` prop drives the input's text when it
// changes; the input's `input` events report back through `onValueChange`.
import { effect, ref, signal, untrack, useId } from "lumiose";
import {
  Combobox,
  type ComboboxClearProps,
  type ComboboxEmptyProps,
  type ComboboxGroupLabelProps,
  type ComboboxGroupProps,
  type ComboboxInputProps,
  type ComboboxItemProps,
  type ComboboxLabelProps,
  type ComboboxListProps,
  type ComboboxPopupProps,
  type ComboboxStatusProps,
  type ComboboxTriggerProps,
} from "../combobox/combobox.tsx";
import type { ComboboxElement, ComboboxOpenChangeDetail } from "../combobox/combobox.script.ts";
import comboboxScript from "../combobox/combobox.script.ts?client";
import { ComboboxContext, type ComboboxContextValue } from "../combobox/context.ts";
import { controlId, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import { batched } from "../batched.ts";

/**
 * How the suggestions complete the text, as in Base UI: `"list"` filters them by the text,
 * `"both"` also shows the highlighted one in the input, `"inline"` only does that (no filtering),
 * `"none"` does neither (the page filters them, as with results from a server).
 */
export type AutocompleteMode = "list" | "both" | "inline" | "none";

/**
 * The element props Root passes to `<lu-combobox>`, without the brand of intrinsic elements' props,
 * so that `bind:value` and `bind:open` apply to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<ComboboxElement> as K extends string ? K : never
  ]: JSX.HTMLProps<ComboboxElement>[K];
};

/**
 * `Autocomplete.Root` renders `<lu-combobox free>` around the other parts. `bind:value={signal}`
 * stands in for `value` and `onValueChange`, `bind:open` for `open` and `onOpenChange`.
 */
export interface AutocompleteRootProps extends Omit<
  ElementProps,
  "children" | "onChange" | "onInput"
> {
  /** Puts this text in the input when it changes. Pair it with `onValueChange`. */
  value?: string;
  /** The text at first, when `value` is left out; a form reset goes back to it. */
  defaultValue?: string;
  /** Called as the text changes: typing, choosing a suggestion, clearing. */
  onValueChange?: (value: string) => void;
  /** Opens (`true`) or closes (`false`) the suggestions when it changes, in the browser. */
  open?: boolean;
  /** Called after the suggestions open or close, whatever opened or closed them. */
  onOpenChange?: (open: boolean) => void;
  /** How the suggestions complete the text. Default `"list"`. */
  mode?: AutocompleteMode;
  /**
   * How `"list"` and `"both"` filter the suggestions by their text: `"contains"` (default) or
   * `"startsWith"`, ignoring case and accents.
   */
  filter?: "contains" | "startsWith";
  /** A click on the input opens the suggestions too; otherwise typing and Arrow Down do. */
  openOnInputClick?: boolean;
  /** The first suggestion is highlighted as you type, so Enter chooses it. */
  autoHighlight?: boolean;
  /** A suggestion the pointer highlighted stays highlighted when the pointer leaves the list. */
  keepHighlight?: boolean;
  /** A click on a suggestion submits the form, as a search box does. */
  submitOnItemClick?: boolean;
  /** Shows at most this many suggestions; a narrower text shows the others. */
  limit?: number;
  /** The name the text is submitted under (the input's). */
  name?: string;
  /** The form needs a text. */
  required?: boolean;
  /** The autocomplete cannot be used. */
  disabled?: boolean;
  /** The other parts: `Label`, `Input`, the buttons, and the `List` or `Popup`. */
  children?: JSX.Element;
}

/** The `<label>` of the input. */
export type AutocompleteLabelProps = ComboboxLabelProps;
/** The `<input role="combobox">`: it has the name and submits the text. */
export type AutocompleteInputProps = ComboboxInputProps;
/** A `<button>` that opens and closes the suggestions, out of the tab order. */
export type AutocompleteTriggerProps = ComboboxTriggerProps;
/** A `<button>` that empties the text, out of the tab order and hidden while it is empty. */
export type AutocompleteClearProps = ComboboxClearProps;
/** A `<div popover>` around the `List`, for an empty state or a status beside the suggestions. */
export type AutocompletePopupProps = ComboboxPopupProps;
/** The `<div role="listbox">` of suggestions: the popup itself, unless it is inside a `Popup`. */
export type AutocompleteListProps = ComboboxListProps;
/** A suggestion, a `<div role="option">`: its `value` is the text it puts in the input. */
export type AutocompleteItemProps = ComboboxItemProps;
/** A `<div role="group">` of suggestions, named by its `GroupLabel`. */
export type AutocompleteGroupProps = ComboboxGroupProps;
/** A `<div role="presentation">` that names its group. */
export type AutocompleteGroupLabelProps = ComboboxGroupLabelProps;
/** A `<div role="status">` shown when no suggestion matches. */
export type AutocompleteEmptyProps = ComboboxEmptyProps;
/** A `<div role="status">` for a loading or result-count message. */
export type AutocompleteStatusProps = ComboboxStatusProps;

function Root({
  value,
  defaultValue,
  onValueChange,
  open,
  onOpenChange,
  mode,
  filter,
  openOnInputClick,
  autoHighlight,
  keepHighlight,
  submitOnItemClick,
  limit,
  name,
  required,
  disabled,
  children,
  ...rest
}: AutocompleteRootProps) {
  // The behaviour, on the server HTML and in islands; the page loads it once (decision-63).
  comboboxScript();
  const id = useId();
  const field = useField();
  const host = ref<ComboboxElement>();
  const completion = untrack(() => mode ?? "list");
  const sent = useFormValues(
    untrack(() => name ?? field?.name()),
    untrack(() => disabled),
  );
  const context: ComboboxContextValue = {
    id,
    inputId: field ? controlId(field) : `${id}-input`,
    selected: () => [],
    multiple: () => false,
    disabled: () => disabled === true || field?.disabled() === true,
    labels: signal(0),
    popup: false,
    text: {
      name: () => name ?? field?.name(),
      required: () => required,
      // A failed submission's text (a Form's `values`) replaces the default (TASK-430).
      initial: untrack(() => value ?? sent?.[0] ?? defaultValue),
      autocomplete: completion,
    },
  };

  // The props drive the input and the popup when they change; the events report back.
  effect(() => {
    const next = value;
    const input = host()?.input;
    if (next !== undefined && input && input.value !== next) input.value = next;
  });
  effect(() => {
    const element = host();
    const wanted = open;
    if (element?.isConnected && wanted !== undefined) element.open = wanted;
  });

  // A form reset puts the input's text back without an `input` event: it goes to
  // `onValueChange` (TASK-435).
  if (onValueChange) {
    onFormReset(
      () => host()?.input ?? undefined,
      () => host()?.input?.value ?? "",
      onValueChange,
    );
  }

  return (
    <ComboboxContext value={context}>
      <lu-combobox
        {...rest}
        ref={host}
        id={id}
        free
        inline={completion === "both" || completion === "inline"}
        filter={completion === "inline" || completion === "none" ? "none" : filter}
        open-on-input-click={openOnInputClick}
        auto-highlight={autoHighlight}
        keep-highlight={keepHighlight}
        submit-on-item-click={submitOnItemClick}
        limit={limit}
        disabled={context.disabled()}
        on:input={batched((event: Event) => {
          const input = host()?.input;
          if (input && event.target === input) onValueChange?.(input.value);
        })}
        on:openchange={batched((event: CustomEvent<ComboboxOpenChangeDetail>) =>
          onOpenChange?.(event.detail.open),
        )}
      >
        {children}
      </lu-combobox>
    </ComboboxContext>
  );
}

/**
 * A text input with suggestions, for text that may be anything (a search, a tag, an address):
 * the APG combobox with list autocomplete, after Base UI's Autocomplete. Unlike a Combobox, the
 * text is the value and no suggestion has to be chosen; the input submits it. `<lu-combobox>`'s
 * script runs it, on server-rendered pages too. Unstyled: style the parts through `class` and
 * `[aria-expanded]`, `:popover-open`, `[aria-disabled]`, `[data-highlighted]`.
 *
 * @example
 * <Autocomplete.Root name="search" bind:value={query}>
 *   <Autocomplete.Label>Search</Autocomplete.Label>
 *   <Autocomplete.Input />
 *   <Autocomplete.List>
 *     <Autocomplete.Item value="lumiose">lumiose</Autocomplete.Item>
 *   </Autocomplete.List>
 * </Autocomplete.Root>
 */
export const Autocomplete = {
  Root,
  Label: Combobox.Label,
  Input: Combobox.Input,
  Trigger: Combobox.Trigger,
  Clear: Combobox.Clear,
  Popup: Combobox.Popup,
  List: Combobox.List,
  Item: Combobox.Item,
  Group: Combobox.Group,
  GroupLabel: Combobox.GroupLabel,
  Empty: Combobox.Empty,
  Status: Combobox.Status,
};
