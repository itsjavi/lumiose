// The runtime the preview iframe runs compiled code against: `lumen` and `lumen/dom` in one
// module, so both share one reactive core. scripts/assets.ts bundles it to
// public/generated/runtime.js; the preview turns each namespace back into a module.
export * as lumen from "lumen";
export * as dom from "lumen/dom";
