// The app's views are routes (src/routes): the URL of each view, the view the URL shows, and
// navigation from keyboard shortcuts and buttons.
import { href } from "lumiose";
import { navigate, route } from "lumiose/router";
import { songId } from "./state.ts";

export type View = "tracker" | "instruments" | "songs" | "settings";

/** The URL of a view. The tracker edits the open song, so its URL names it: a deep link. */
export function viewHref(view: View): string {
  switch (view) {
    case "tracker":
      return href("/songs/[id]", { id: songId() });
    case "instruments":
      return href("/instruments");
    case "songs":
      return href("/songs");
    case "settings":
      return href("/settings");
  }
}

/** The view of the current route. Reactive. */
export function currentView(): View | undefined {
  switch (route()) {
    case "/":
    case "/songs/[id]":
      return "tracker";
    case "/songs":
      return "songs";
    case "/instruments":
      return "instruments";
    case "/settings":
      return "settings";
    default:
      return undefined;
  }
}

export function showView(view: View): void {
  void navigate(viewHref(view));
}
