// `.css` imports: ambient module types loaded by `lumiose/env` (TASK-122). A script file (no top-level
// import), so that `declare module "*.css"` declares a module pattern instead of augmenting a
// module. TypeScript 7 checks side-effect imports (`noUncheckedSideEffectImports`), so a plain
// `import "./app.css"` needs a declaration. Compatible with `vite/client`, which may be loaded too.
//
// CSS modules (TASK-334): `*module.css` is declared before `*.css`. Both patterns have the same
// (empty) prefix, and on such a tie TypeScript uses the pattern declared first, so `*.css` first
// would match CSS modules too and lose their class map. The pattern leaves out the dot of
// `.module.css` on purpose: `vite/client` declares `*.module.css`, and two declarations of one
// name merge into a duplicate default export when library checks are on. (It also matches a file
// named `xmodule.css`, which Vite does not treat as a CSS module.)

/**
 * A CSS module (`*.module.css`): Vite hashes its class names, and the default export maps each name
 * in the file to its hashed class, as `vite/client`'s `CSSModuleClasses`: `class={styles.button}`.
 */
declare module "*module.css" {
  const classNames: { readonly [className: string]: string };
  export default classNames;
}

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
