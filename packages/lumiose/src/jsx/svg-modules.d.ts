// `.svg` imports (`lumiose({ svg })`, TASK-70, decision-46; owner: Halo): ambient module types
// loaded by `lumiose/env`. A script file (no top-level import), so that `declare module` declares
// module patterns instead of augmenting a module. Bare `.svg` imports are Vite's URLs, typed by
// `vite/client` like every other asset, so nothing here clashes with it.

declare module "*.svg?component" {
  /**
   * The file as an inline SVG component. Props are those of `<svg>` and override the file's
   * root attributes. `title` labels the icon (a `<title>` with `role="img"`); without `title`,
   * `aria-label` or `aria-labelledby` it is decorative (`aria-hidden="true"`).
   */
  const Svg: (
    props: import("lumiose/jsx-runtime").JSX.SVGProps<SVGSVGElement> & { title?: string },
  ) => import("lumiose/jsx-runtime").JSX.Element;
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
