// The kit's sources, for the showcase's `.stsx` files. They import this module rather than
// `../../src/…` directly: `lumen check` cannot resolve a `.stsx` import that leaves `src/` (the
// shadow file sits elsewhere; see TASK-59 notes).
export * from "../../src/index.ts";
export * from "../../src/tokens.ts";
