// The context a CheckboxGroup gives its checkboxes: the selected values, every value (for a parent
// checkbox) and the name they submit under.
import { createContext } from "lumiose";

export interface CheckboxGroupContextValue {
  values: () => readonly string[];
  allValues: () => readonly string[] | undefined;
  name: () => string | undefined;
}

export const CheckboxGroupContext = createContext<CheckboxGroupContextValue>();
