// The app's views are routes (src/routes): the URL of each view, the view the URL shows, and
// navigation from keyboard shortcuts and buttons.
import { href } from "lumen";
import { navigate, url } from "lumen/router";
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

/** The view of the current URL. Reactive. */
export function currentView(): View | undefined {
  const path = url().pathname;
  if (path.startsWith("/songs/")) return "tracker";
  if (path === "/songs") return "songs";
  if (path === "/instruments") return "instruments";
  if (path === "/settings") return "settings";
  return undefined;
}

export function showView(view: View): void {
  void navigate(viewHref(view));
}
