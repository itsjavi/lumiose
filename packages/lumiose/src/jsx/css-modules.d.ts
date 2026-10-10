// `.css` imports: ambient module types loaded by `lumiose/env` (TASK-122). A script file (no top-level
// import), so that `declare module "*.css"` declares a module pattern instead of augmenting a
// module. TypeScript 7 checks side-effect imports (`noUncheckedSideEffectImports`), so a plain
// `import "./app.css"` needs a declaration. Compatible with `vite/client`, which may be loaded too.

/** A stylesheet imported for its side effect: Vite bundles it into the page's CSS. */
declare module "*.css" {}

declare module "*.css?url" {
  /** The stylesheet's URL (Vite). */
  const url: string;
  export default url;
}

declare module "*.css?inline" {
  /** The processed stylesheet as a string, not added to the page (Vite). */
  const css: string;
  export default css;
}

declare module "*.css?raw" {
  /** The file's source text (Vite). */
  const source: string;
  export default source;
}
