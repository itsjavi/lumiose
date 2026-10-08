// `.svg` imports (`lumen({ svg })`, TASK-70; owner: Halo): ambient module types loaded by
// `lumen/env`. A script file (no top-level import), so that `declare module "*.svg"` declares a
// module pattern instead of augmenting a module.

declare module "*.svg" {
  /**
   * The file as an inline SVG component. Props are those of `<svg>` and override the file's
   * root attributes. `title` labels the icon (a `<title>` with `role="img"`); without `title`,
   * `aria-label` or `aria-labelledby` it is decorative (`aria-hidden="true"`).
   */
  const Svg: (
    props: import("lumen/jsx-runtime").JSX.SVGProps<SVGSVGElement> & { title?: string },
  ) => import("lumen/jsx-runtime").JSX.Element;
  export default Svg;
}

declare module "*.svg?inline" {
  /** The same inline component as a plain `.svg` import. */
  const Svg: (
    props: import("lumen/jsx-runtime").JSX.SVGProps<SVGSVGElement> & { title?: string },
  ) => import("lumen/jsx-runtime").JSX.Element;
  export default Svg;
}

declare module "*.svg?url" {
  /** The file's URL (Vite). */
  const url: string;
  export default url;
}

declare module "*.svg?raw" {
  /** The file's text (Vite). */
  const raw: string;
  export default raw;
}
