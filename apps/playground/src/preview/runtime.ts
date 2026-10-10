// The runtime the preview iframe runs compiled code against: `lumiose` and `lumiose/dom` in one
// module, so both share one reactive core. scripts/assets.ts bundles it to
// public/generated/runtime.js; the preview turns each namespace back into a module.
export * as lumiose from "lumiose";
export * as dom from "lumiose/dom";
