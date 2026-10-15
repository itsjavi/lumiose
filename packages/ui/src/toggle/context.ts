// The context a ToggleGroup gives its toggles: the pressed values and the toggles rendered so far,
// for the group's one tab stop in the server HTML.
import { createContext, type Signal } from "lumiose";

export interface ToggleRecord {
  value: string | undefined;
  disabled: () => boolean;
}

export interface ToggleGroupContextValue {
  values: () => readonly string[];
  items: Signal<ToggleRecord[]>;
  disabled: () => boolean;
}

export const ToggleGroupContext = createContext<ToggleGroupContextValue>();
