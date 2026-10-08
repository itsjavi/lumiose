// `lumen/vite`: Vite plugin (owner: Photon). Spec §5.5.
import type { Plugin } from "vite";

export interface LumenOptions {}

export default function lumen(_options: LumenOptions = {}): Plugin[] {
  return [{ name: "lumen" }];
}
