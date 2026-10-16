// `lumiose/dom`: runtime imported by compiled client output (owner: Spark).
// Implements `ClientRuntime` from the compiler-runtime contract (src/contract/client.ts, doc-2).
export { renderEffect as bind } from "../core/internal.ts";
export { template } from "./template.ts";
export { outputTemplate } from "./output.ts";
export {
  applyScope,
  setAttr,
  setClass,
  setNonce,
  setProp,
  setStyle,
  setStyleProperty,
  setText,
  toggleClass,
} from "./attributes.ts";
export { branch, branchValue, insert, insertText, insertValue } from "./insert.ts";
export { list, listValue } from "./list.ts";
export { selector } from "./selector.ts";
export { createComponent, mergeProps, restProps } from "./component.ts";
export { $async, $await, $leave } from "./async.ts";
export { spread } from "./spread.ts";
export { delegateEvents, listen } from "./events.ts";
export { attach, bindChecked, bindProperty, bindValue, useRef } from "./element.ts";
// Not part of the contract: rendering an app root for SPA entries, tests and benchmarks.
export { render, type RenderOptions } from "./render.ts";
