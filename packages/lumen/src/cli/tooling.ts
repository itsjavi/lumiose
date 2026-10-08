// `lumen/tooling`: build-time tooling API for editor/CLI integrations (owner: Beacon).
// Not part of the runtime; used by @lumen/language-server and future integrations.
export * from "./check/index.ts";
export { syncShadows } from "./check/shadow.ts";
