// The English defaults of @lumiose/ui (TASK-456, L37): each one the components use is listed in
// docs/README.md's Localisation section, so a translation knows what to override.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const DEFAULTS: [text: string, source: string][] = [
  ["Notifications (F6)", "src/toast/toast.tsx"],
  ["Remove", "src/combobox/combobox.script.ts"],
  ["Increase", "src/number-field/number-field.tsx"],
  ["Decrease", "src/number-field/number-field.tsx"],
];

describe("English defaults", () => {
  const localisation = read("docs/README.md").split("## Localisation")[1]!.split("\n## ")[0]!;

  it.each(DEFAULTS)("%s is a default of %s, listed in the docs", (text, source) => {
    expect(read(source)).toContain(`"${text}"`);
    expect(localisation).toContain(`"${text}"`);
  });
});
