// Theme selection. Without a stored choice the site follows the system (`prefers-color-scheme`,
// through `color-scheme: light dark` in the base stylesheet); `<html data-theme="light|dark">`
// overrides it. ThemeToggle stores the choice; `themeInitScript` re-applies it before first paint.

export type Theme = "light" | "dark";

/** The localStorage key holding the explicit choice. */
export const THEME_STORAGE_KEY = "lumen-theme";

/**
 * An inline script for the document `<head>` (before any stylesheet paints), so a stored choice
 * applies without a flash of the system theme: `<script innerHTML={themeInitScript} />`.
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The stored choice, if any (storage can be unavailable: private mode, blocked cookies). */
export function storedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The theme in effect: the explicit choice on `<html>`, else the system preference. */
export function activeTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies `theme` to the document and stores it. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not persisted; the choice still holds for this page.
  }
}
