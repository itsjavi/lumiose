// Every component compiles for the server and the browser without a diagnostic (TASK-391): an app
// compiles @lumiose/ui from its sources (decision-65), so a warning here shows up in every app's
// dev server and build.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, type CompileTarget } from "@lumiose/compiler";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL(".", import.meta.url));
const components = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
  (path) => path.endsWith(".tsx") && !path.includes(".test."),
);

describe("@lumiose/ui compiles cleanly", () => {
  it.each(
    components.flatMap((path) => (["server", "client"] as CompileTarget[]).map((t) => [path, t])),
  )("%s for the %s", (path, target) => {
    const file = join(src, path);
    const { diagnostics } = compile(readFileSync(file, "utf8"), file, {
      target: target as CompileTarget,
      sourceMap: false,
      styleImport: false,
    });
    expect(diagnostics.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
  });
});
