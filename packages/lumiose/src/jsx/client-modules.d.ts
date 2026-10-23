// `?client` imports (decision-63, TASK-354): ambient module types loaded by `lumiose/env`. A script
// file (no top-level import), so that `declare module` declares a module pattern instead of
// augmenting a module.

declare module "*?client" {
  /**
   * Loads the imported module in the browser on the page being rendered: call it while a
   * server-rendered component renders, and the page gets one module script for it, without the
   * island runtime. The module never runs on the server. In islands and SPA pages the import loads
   * the module itself and the call does nothing, unless the importer only calls it conditionally:
   * then the first call loads the module.
   */
  const clientScript: () => void;
  export default clientScript;
}
