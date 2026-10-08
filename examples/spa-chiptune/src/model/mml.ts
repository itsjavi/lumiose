// Macro text notation (as in FamiTracker's MML): values separated by spaces, `|` before the loop
// point and `/` after the release point. "15 14 | 13 12 / 8 4 0" loops 13 12 while the note is held,
// then plays 8 4 0 after the release.
import type { Macro } from "./types.ts";

export function formatMacro(macro: Macro): string {
  const parts: string[] = [];
  macro.values.forEach((value, i) => {
    if (i === macro.loop) parts.push("|");
    parts.push(String(value));
    if (i === macro.release) parts.push("/");
  });
  return parts.join(" ");
}

export function parseMacro(text: string, min: number, max: number): Macro {
  const values: number[] = [];
  let loop = -1;
  let release = -1;
  for (const token of text.replace(/([|/])/g, " $1 ").split(/[\s,]+/)) {
    if (token === "") continue;
    if (token === "|") loop = values.length;
    else if (token === "/") release = values.length - 1;
    else {
      const value = Number.parseInt(token, 10);
      if (Number.isFinite(value)) values.push(Math.min(max, Math.max(min, value)));
    }
    if (values.length >= 64) break;
  }
  return {
    values,
    loop: loop >= values.length ? -1 : loop,
    release: release >= values.length ? -1 : release,
  };
}
