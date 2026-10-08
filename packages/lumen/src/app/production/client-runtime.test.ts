// How `lumen build` packages the client runtime (./client-runtime.ts, TASK-91): one runtime chunk,
// in the only client entry when there is one, no island loader or hydration in an SPA where nothing
// hydrates, and Lumen's preload helper instead of Vite's. Fixture apps in temp dirs, as in
// ./build.test.ts.
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "vite";
import { build } from "./build.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const lumenRoot = resolve(import.meta.dirname, "../../..");
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-runtime-")));
  roots.push(root);
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
  return root;
}

/** Builds the app; returns its client JS files by name prefix (`loader`, `spa`, `lumen`, …). */
async function scripts(root: string): Promise<Record<string, string>> {
  const { clientDir } = await build({
    root,
    customLogger: createLogger("silent"),
    logLevel: "silent",
  });
  const files: Record<string, string> = {};
  for (const file of readdirSync(join(clientDir, "assets")).filter((f) => f.endsWith(".js"))) {
    files[file.replace(/-[\w-]+\.js$/, "")] = readFileSync(join(clientDir, "assets", file), "utf8");
  }
  return files;
}

const COUNTER = `import { signal } from "lumen";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`;
const SPA_LAYOUT = `export const mode = "spa";
export default function App(props: { children?: JSX.Element }) { return <main>{props.children}</main>; }
`;

// Strings only Vite's own preload helper, the island loader and hydration contain.
const VITE_PRELOAD = "vite:preloadError";
const ISLAND_LOADER = "IntersectionObserver";
const HYDRATION = "data-l-slot";

describe.skipIf(!binding)("the client runtime of lumen build", () => {
  it("puts the runtime of an islands app in the island loader's chunk", async () => {
    const files = await scripts(
      project({
        "src/routes/index.stsx": `import { Counter } from "../components/Counter.stsx";
export default function Home() { return <Counter client:load start={1} />; }
`,
        "src/components/Counter.stsx": COUNTER,
      }),
    );
    expect(Object.keys(files).toSorted()).toEqual(["Counter", "loader"]);
    expect(files.loader).toContain(ISLAND_LOADER);
    expect(files.loader).toContain(HYDRATION);
    expect(files.loader).not.toContain(VITE_PRELOAD);
    expect(files.loader).toContain("csp-nonce");
    // The island imports the runtime from the loader's chunk.
    expect(files.Counter).toMatch(/from"\.\/loader-[\w-]+\.js"/);
  });

  it("leaves the island loader and hydration out of an SPA where nothing hydrates", async () => {
    const files = await scripts(
      project({
        "src/routes/_layout.stsx": `export const ssr = false;\n${SPA_LAYOUT}`,
        "src/routes/index.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      }),
    );
    expect(Object.keys(files).toSorted()).toEqual(["_layout", "routes", "spa"]);
    expect(files.spa).toContain("#lumen:csr");
    expect(files.spa).not.toContain(ISLAND_LOADER);
    expect(files.spa).not.toContain(HYDRATION);
    expect(files.spa).not.toContain(VITE_PRELOAD);
    expect(files["_layout"]).toMatch(/from"\.\/spa-[\w-]+\.js"/);
  });

  it("shares one runtime chunk between the island loader and a hydrating SPA", async () => {
    const files = await scripts(
      project({
        "src/routes/index.stsx": `import { Counter } from "../components/Counter.stsx";
export default function Home() { return <Counter client:load start={1} />; }
`,
        "src/components/Counter.stsx": COUNTER,
        "src/routes/app/_layout.stsx": SPA_LAYOUT,
        "src/routes/app/index.stsx": "export default function Page() { return <h1>Page</h1>; }\n",
      }),
    );
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["loader", "spa", "lumen"]));
    expect(files.lumen).toContain(ISLAND_LOADER);
    expect(files.lumen).toContain(HYDRATION);
    for (const entry of [files.loader!, files.spa!]) {
      expect(entry).toMatch(/from"\.\/lumen-[\w-]+\.js"/);
      expect(entry).not.toContain(HYDRATION);
    }
  });
});
