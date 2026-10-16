// The context a Toolbar gives its items (TASK-383), Toggles in a ToggleGroup inside it included:
// the orientation and the disabled state, which reaches its Menu and Popover triggers and Toggles
// too (TASK-437 M13).
import { createContext } from "lumiose";

export interface ToolbarContextValue {
  orientation: () => "horizontal" | "vertical";
  disabled: () => boolean;
}

export const ToolbarContext = createContext<ToolbarContextValue>();

/**
 * What a popup gives its content instead (Menu.Popup, Popover.Popup): the content of a popup
 * opened from a toolbar is not the toolbar's, whose script skips popups too, so its toggles and
 * triggers keep their own tab stops.
 */
export const OUTSIDE_TOOLBAR = undefined as unknown as ToolbarContextValue;
