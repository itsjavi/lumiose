// The names of the design's custom properties, read in style blocks as `var($vars.brand)`: a
// mistyped name fails the build (LUM3008) and `tsc`. The values are declared on `:root` in
// App.stsx, so themes and the cascade can change them.
export const vars = {
  brand: "--brand",
  surface: "--surface",
  ink: "--ink",
  radius: { sm: "--radius-sm", lg: "--radius-lg" },
} as const;
