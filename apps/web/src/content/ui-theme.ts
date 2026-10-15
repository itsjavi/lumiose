// The default theme's custom properties, read from @lumiose/ui's stylesheet (the only source of
// their values), for the palette of the /ui theming page: each `--lu-` property of the theme's
// `:root` rule with its light and dark value (`light-dark(<light>, <dark>)`, or one value for both).

import theme from "@lumiose/ui/themes/default.css?raw";

export interface ThemeProperty {
  /** `--lu-primary`. */
  name: string;
  light: string;
  dark: string;
}

export function themeProperties(css: string = theme): ThemeProperty[] {
  const root = /:root\s*\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ""))?.[1] ?? "";
  return [...root.matchAll(/(--lu-[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => {
    const pair = /^light-dark\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/.exec(value!.trim());
    return { name: name!, light: pair?.[1] ?? value!.trim(), dark: pair?.[2] ?? value!.trim() };
  });
}

/** The inline style that pins one scheme of the theme on a subtree: every property's value. */
export function schemeStyle(scheme: "light" | "dark", properties = themeProperties()): string {
  return [
    `color-scheme: ${scheme}`,
    ...properties.map((property) => `${property.name}: ${property[scheme]}`),
  ].join("; ");
}
