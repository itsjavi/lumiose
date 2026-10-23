// The context the Combobox parts share, with Autocomplete's Root (TASK-377): the same parts work
// under either Root, which says how the input behaves.
import { createContext, onCleanup, useContext, type Signal } from "lumiose";
import { notInside } from "../not-inside.ts";

export interface ComboboxContextValue {
  /** The element's id; the parts' ids and the anchor name derive from it. */
  id: string;
  /** The input's id, which a Label points at: the Field's control id inside a Field. */
  inputId: string;
  /** The selected values, as the element last reported them (none in an Autocomplete). */
  selected: () => string[];
  multiple: () => boolean;
  disabled: () => boolean;
  /** The combobox needs a value: its input says so with `aria-required` (TASK-431). */
  required?: () => boolean;
  /** How many Labels are rendered: the listbox is named by the label only when there is one. */
  labels: Signal<number>;
  /** A Label's own `id`, which the listbox points at (TASK-441 M39). */
  labelId?: string;
  /** Whether the parts are inside a `Popup`: the `List` is then not the popover. */
  popup: boolean;
  /**
   * In an Autocomplete, the input itself is the form control: its name, `required`, its first
   * text, and the kind of completion it announces (`aria-autocomplete`).
   */
  text?: {
    name: () => string | undefined;
    required: () => boolean | undefined;
    initial: string | undefined;
    autocomplete: "list" | "both" | "inline" | "none";
  };
}

export const ComboboxContext = createContext<ComboboxContextValue>();

export function useCombobox(): ComboboxContextValue {
  const context = useContext(ComboboxContext);
  if (!context) throw notInside("Combobox parts", "<Combobox.Root>");
  return context;
}

/** Counts a rendered part in `count` while it is mounted. */
export function register(count: Signal<number>) {
  count.update((n) => n + 1);
  onCleanup(() => count.update((n) => n - 1));
}
