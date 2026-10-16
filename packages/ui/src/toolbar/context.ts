// The context a Toolbar gives its items (TASK-383), Toggles in a ToggleGroup inside it included:
// the server HTML's single tab stop (the first item rendered), the orientation and the disabled
// state.
import { createContext } from "lumiose";

export interface ToolbarContextValue {
  orientation: () => "horizontal" | "vertical";
  disabled: () => boolean;
  /** The next item's `tabindex` in the server HTML: `0` for the first item, `-1` after it. */
  stop: () => 0 | -1;
}

export const ToolbarContext = createContext<ToolbarContextValue>();

/**
 * What a popup gives its content instead (Menu.Popup, Popover.Popup): the content of a popup
 * opened from a toolbar is not the toolbar's, whose script skips popups too, so its toggles and
 * triggers keep their own tab stops.
 */
export const OUTSIDE_TOOLBAR = undefined as unknown as ToolbarContextValue;
