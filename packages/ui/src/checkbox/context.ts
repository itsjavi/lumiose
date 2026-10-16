// The context a CheckboxGroup gives its checkboxes: the selected values, every value (for a parent
// checkbox) and the name they submit under.
import { createContext } from "lumiose";

export interface CheckboxGroupContextValue {
  /** The group's id: its checkboxes' ids are `<id>-<value>`, which a parent's `aria-controls` names. */
  id: string;
  values: () => readonly string[];
  allValues: () => readonly string[] | undefined;
  name: () => string | undefined;
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue>();

/** The id of a group's checkbox of `value`: ids may not hold spaces. */
export const optionId = (group: CheckboxGroupContextValue, value: string) =>
  `${group.id}-${encodeURIComponent(value).replaceAll("%", "_")}`;
