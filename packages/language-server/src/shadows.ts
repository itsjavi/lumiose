// Shadow TSX paths and sync, shared with `lumen check` (TASK-27, spec §9.1).
// TODO(Lux): import from a `lumen` package export (e.g. `lumen/check`) once
// packages/lumen/package.json exposes one; until then this is the only cross-package source import.
export {
  SHADOW_DIR,
  shadowPathFor,
  sourcePathForShadow,
  syncShadows,
} from "../../lumen/src/cli/check/shadow.ts";
