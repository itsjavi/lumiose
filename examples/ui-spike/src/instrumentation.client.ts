// TASK-332 finding: Lumiose has no way yet to ship a custom element's definition with a
// server-rendered page that has no island, so the spike loads each option's elements here, by path.
// @lumiose/ui needs that mechanism (see the task's implementation list).
const path = location.pathname;
if (path.startsWith("/a")) await import("./option-a/elements.ts");
else if (path.startsWith("/b")) await import("./option-b/elements.ts");

// A module, for the top-level await.
// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
