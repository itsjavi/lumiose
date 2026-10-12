// How `lumiose build` packages the client runtime (./client-runtime.ts, TASK-91): one runtime chunk,
// in the only client entry when there is one, no island loader or hydration in an SPA where nothing
// hydrates, and Lumiose's preload helper instead of Vite's. Fixture apps in temp dirs, as in
// ./build.test.ts.
import { linkLumiose } from "../../test-links.ts";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createLogger } from "vite";
import { build } from "./build.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-runtime-")));
  roots.push(root);
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  return root;
}

/** Builds the app; returns its client JS files by name prefix (`loader`, `spa`, `lumiose`, …). */
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

const COUNTER = `import { signal } from "lumiose";
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

describe.skipIf(!binding)("the client runtime of lumiose build", () => {
  it("puts the runtime of an islands app in the island loader's chunk", async () => {
    const files = await scripts(
      project({
        "src/routes/page.stsx": `import { Counter } from "../components/Counter.stsx";
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

  // TASK-228: runtime that one island imports loads with that island only; runtime that several
  // islands share goes to the runtime chunk, not to a chunk of its own (one more request each).
  const POSTER = `import { submit } from "lumiose";
export function Poster() {
  return <form onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}><button>Save</button></form>;
}
`;
  const FETCHER = `import { fetchJSON } from "lumiose";
export function Fetcher() {
  return <button onClick={() => fetchJSON("/api")}>Load</button>;
}
`;
  const islandsApp = (counter: string, other: "Poster" | "Fetcher") =>
    project({
      "src/routes/page.stsx": `import { Counter } from "../components/Counter.stsx";
import { ${other} } from "../components/${other}.stsx";
export default function Home() { return <main><Counter client:load start={1} /><${other} client:load /></main>; }
`,
      "src/components/Counter.stsx": counter,
      [`src/components/${other}.stsx`]: other === "Poster" ? POSTER : FETCHER,
    });
  // Strings only lumiose's submit() (app/actions/client.ts) and fetchJSON (app/fetch-json.ts) hold.
  const SUBMIT = "formaction";
  const FETCH_JSON = "application/json";
  // A string the page cache (app/cache/client.ts) holds.
  const PAYLOAD = "data-l-payload";

  it("keeps runtime that one island imports in that island's chunk (TASK-228)", async () => {
    const files = await scripts(islandsApp(COUNTER, "Poster"));
    expect(Object.keys(files).toSorted()).toEqual(["Counter", "Poster", "loader"]);
    expect(files.Poster).toContain(SUBMIT);
    expect(files.loader).not.toContain(SUBMIT);
    expect(files.Counter).not.toContain(SUBMIT);
    // The rest of the runtime still comes from the loader's chunk.
    expect(files.Poster).toMatch(/from"\.\/loader-[\w-]+\.js"/);
  });

  it("puts runtime that several islands import in the runtime chunk, not a chunk of its own (TASK-228)", async () => {
    const files = await scripts(
      islandsApp(
        `import { signal, submit } from "lumiose";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <form onSubmit={(event) => submit(event.currentTarget)}>{count()}</form>;
}
`,
        "Poster",
      ),
    );
    expect(Object.keys(files).toSorted()).toEqual(["Counter", "Poster", "loader"]);
    expect(files.loader).toContain(SUBMIT);
    expect(files.Poster).not.toContain(SUBMIT);
    expect(files.Counter).not.toContain(SUBMIT);
  });

  it("keeps fetchJSON in its island's chunk and only its cache gate in the runtime chunk (TASK-233)", async () => {
    const files = await scripts(islandsApp(COUNTER, "Fetcher"));
    expect(Object.keys(files).toSorted()).toEqual(["Counter", "Fetcher", "loader"]);
    expect(files.Fetcher).toContain(FETCH_JSON);
    expect(files.loader).not.toContain(FETCH_JSON);
    // The cache, and the gate in front of it, come from the loader's chunk, where the minifier can
    // fold `hasRuns` (app/cache/run-fetch.ts).
    expect(files.Fetcher).not.toContain(PAYLOAD);
    expect(files.Fetcher).toMatch(/from"\.\/loader-[\w-]+\.js"/);
  });

  it("leaves the island loader and hydration out of an SPA where nothing hydrates", async () => {
    const files = await scripts(
      project({
        "src/routes/layout.stsx": `export const ssr = false;\n${SPA_LAYOUT}`,
        "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      }),
    );
    // The router's History API fallback: a chunk of its own, loaded without the Navigation API.
    expect(Object.keys(files).toSorted()).toEqual(["history", "layout", "page", "spa"]);
    expect(files.spa).toContain("#lumiose:csr");
    expect(files.spa).not.toContain("scrollRestoration");
    expect(files.history).toContain("scrollRestoration");
    expect(files.spa).not.toContain(ISLAND_LOADER);
    expect(files.spa).not.toContain(HYDRATION);
    expect(files.spa).not.toContain(VITE_PRELOAD);
    expect(files["layout"]).toMatch(/from"\.\/spa-[\w-]+\.js"/);
  });

  it("shares one runtime chunk between the island loader and a hydrating SPA", async () => {
    const files = await scripts(
      project({
        "src/routes/page.stsx": `import { Counter } from "../components/Counter.stsx";
export default function Home() { return <Counter client:load start={1} />; }
`,
        "src/components/Counter.stsx": COUNTER,
        "src/routes/app/layout.stsx": SPA_LAYOUT,
        "src/routes/app/page.stsx": "export default function Page() { return <h1>Page</h1>; }\n",
      }),
    );
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["loader", "spa", "lumiose"]));
    expect(files.lumiose).toContain(ISLAND_LOADER);
    expect(files.lumiose).toContain(HYDRATION);
    for (const entry of [files.loader!, files.spa!]) {
      expect(entry).toMatch(/from"\.\/lumiose-[\w-]+\.js"/);
      expect(entry).not.toContain(HYDRATION);
    }
  });

  it("modulepreloads an SPA page's layout and page chunks, and nothing on MPA pages (TASK-123)", async () => {
    const root = project({
      "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      "src/routes/app/layout.stsx": SPA_LAYOUT,
      "src/routes/app/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export default function Page() { return <Counter start={1} />; }
`,
      "src/components/Counter.stsx": COUNTER,
    });
    const { serverEntry } = await build({
      root,
      customLogger: createLogger("silent"),
      logLevel: "silent",
    });
    const entry = (await import(pathToFileURL(serverEntry!).href)) as {
      default: { fetch(request: Request): Promise<Response> };
    };
    const preloads = async (path: string): Promise<string[]> => {
      const html = await (await entry.default.fetch(new Request(`http://app.test${path}`))).text();
      return [...html.matchAll(/<link rel="?modulepreload"? href="?([^">]+)/g)].map((match) =>
        match[1]!.replace(/-[\w-]+\.js$/, ""),
      );
    };
    const spaPage = await preloads("/app");
    // The layout chunk and the page's, which holds the Counter too.
    expect(spaPage).toContain("/assets/layout");
    expect(spaPage.filter((name) => name === "/assets/page").length).toBeGreaterThan(0);
    expect(spaPage).not.toContain("/assets/spa");
    expect(await preloads("/")).toEqual([]);
  });
});
