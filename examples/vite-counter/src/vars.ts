// The names of the design's custom properties, read in style blocks as `var($vars.accent)`: a
// mistyped name fails the build (LUM3008) and `lumiose check`. The values are declared on `:root`
// in App.stsx. Editing this file hot-updates the CSS only.
export const vars = {
  accent: "--accent",
  danger: "--danger",
  border: "--border",
  radius: "--radius",
  space: "--space",
} as const;
