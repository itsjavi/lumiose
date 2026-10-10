// Constants for the style fixtures (read by the golden harness as a host module).
import { base } from "./base.ts";

export const radius = { sm: base / 2, lg: base * 2 } as const;
export const palette = { text: "#222", accent: `oklch(0.7 0.1 ${base * 30})` } as const;
export const used = "used at runtime";
export * from "./more.ts";
