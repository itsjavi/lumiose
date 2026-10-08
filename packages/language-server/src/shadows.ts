// Shadow TSX paths and sync, shared with `lumen check` (TASK-27, spec §9.1).
export {
  SHADOW_DIR,
  shadowLayout,
  shadowPathFor,
  sourcePathForShadow,
  syncShadows,
  type ShadowLayout,
} from "lumen/tooling";
