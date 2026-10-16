// `@lumiose/vite` under Vitest (TASK-54): with only `plugins: [lumiose()]`, component tests in a DOM
// environment (happy-dom) get the browser entry of `lumiose` (reactive updates), while tests in the
// node environment keep the node entry (server rendering), and scoped state is fresh in each test
// (TASK-193). Runs the Vitest CLI on a fixture in a
// temp dir whose node_modules link to this package, Vitest and happy-dom.
import { linkLumiose } from "./test-links.ts";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join as joinPath } from "node:path";
import { normalizePath } from "vite";
import { afterAll, describe, expect, it } from "vitest";

// Vite's ids use `/`, also on Windows: so do the paths in these expectations.
const join = (...parts: string[]): string => normalizePath(joinPath(...parts));

const binding = await import("@lumiose/compiler").catch(() => undefined);
const require = createRequire(import.meta.url);
const vitestRoot = dirname(require.resolve("vitest/package.json"));
const happyDomRoot = dirname(
  createRequire(join(vitestRoot, "package.json")).resolve("happy-dom/package.json"),
);

const FILES: Record<string, string> = {
  "package.json": `{ "type": "module" }\n`,
  "vitest.config.ts": `import lumiose from "@lumiose/vite";
// The packages are linked from outside this temp dir; an installed @lumiose/vite sits inside it.
export default { plugins: [lumiose()], server: { fs: { strict: false } }, test: { include: ["*.test.ts"] } };
`,
  "Counter.tsx": `import { signal } from "lumiose";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => count.update((n) => n + 1)}>Clicked {count()} times</button>;
}
`,
  "dom.test.ts": `// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { flush } from "lumiose";
import { createComponent, render } from "lumiose/dom";
import { Counter } from "./Counter.tsx";

it("updates a mounted component", () => {
  const app = document.body.appendChild(document.createElement("div"));
  render(() => createComponent(Counter, {}), app);
  app.querySelector("button")!.click();
  flush();
  expect(app.textContent).toBe("Clicked 1 times");
});
`,
  "counter.ts": `import { defineState, signal } from "lumiose";
export const counter = defineState(() => signal(0));
`,
  // Scoped state is fresh in each test (TASK-193): the plugin's Vitest setup file.
  "state.test.ts": `// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { counter } from "./counter.ts";
it("first", () => {
  counter().update((n) => n + 1);
  expect(counter()()).toBe(1);
});
it("second", () => {
  expect(counter()()).toBe(0);
});
`,
  "server-state.test.ts": `import { expect, it } from "vitest";
import { counter } from "./counter.ts";
it("first", () => {
  counter().set(5);
  expect(counter()()).toBe(5);
});
it("second", () => {
  expect(counter()()).toBe(0);
});
`,
  "server.test.ts": `import { expect, it } from "vitest";
import { renderToString } from "lumiose";
import { Counter } from "./Counter.tsx";

it("renders on the server entry", async () => {
  expect(await renderToString(() => Counter())).toContain("Clicked 0 times");
});
`,
};

let root: string | undefined;

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.skipIf(!binding)("@lumiose/vite in Vitest", () => {
  it("gives DOM tests the browser entry and node tests the server entry", () => {
    root = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-vitest-"))));
    for (const [name, code] of Object.entries(FILES)) writeFileSync(join(root, name), code);
    mkdirSync(join(root, "node_modules"));
    linkLumiose(root);
    symlinkSync(vitestRoot, join(root, "node_modules/vitest"), "junction");
    symlinkSync(happyDomRoot, join(root, "node_modules/happy-dom"), "junction");
    // A clean environment: the outer run's VITEST_* variables would change the inner one.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")),
    );
    // Vitest 5 writes the JSON report to a file, not to stdout.
    const output = join(root, "report.json");
    const run = spawnSync(
      process.execPath,
      [join(vitestRoot, "vitest.mjs"), "run", "--reporter=json", `--outputFile=${output}`],
      { cwd: root, env: { ...env, NODE_ENV: "test" }, encoding: "utf8", timeout: 60_000 },
    );
    expect(existsSync(output), run.stderr).toBe(true);
    const report = JSON.parse(readFileSync(output, "utf8")) as {
      testResults: {
        name: string;
        assertionResults: { status: string; failureMessages: string[] }[];
      }[];
    };
    const results = Object.fromEntries(
      report.testResults.map((file) => [
        file.name.slice(root!.length + 1),
        file.assertionResults.map((test) => test.failureMessages.join("\n") || test.status),
      ]),
    );
    expect(results).toEqual({
      "dom.test.ts": ["passed"],
      "server.test.ts": ["passed"],
      "state.test.ts": ["passed", "passed"],
      "server-state.test.ts": ["passed", "passed"],
    });
  }, 60_000);
});
