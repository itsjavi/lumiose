// `lumiose dev` end to end: a real Vite 8 dev server (ssr module runner + client environment) on a
// fixture app written to a temp dir whose node_modules/lumiose links to this package.
import { linkLumiose, LUMIOSE_ROOT } from "../../test-links.ts";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLogger, normalizePath, type HotPayload } from "vite";
import { createDevServer, type DevServer } from "./server.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "src/styles.css": "body { color: rgb(1, 2, 3); }\n",
  "src/routes/layout.stsx": `import "../styles.css";
export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}</div>;
}
`,
  "src/routes/page.stsx": `import { Suspense, Title } from "lumiose";
async function Slow() {
  const text = await new Promise<string>((resolve) => setTimeout(() => resolve("slow content"), 50));
  return <p class="slow">{text}</p>;
}
export default function Home() {
  return (
    <main>
      <Title>Home</Title>
      <h1>Home</h1>
      <Suspense fallback={<p class="fallback">Loading</p>}>
        <Slow />
      </Suspense>
    </main>
  );
}
`,
  "src/routes/stream/page.stsx": `import { Suspense, url } from "lumiose";
export const mode = "server";
async function Slow() {
  const text = await new Promise<string>((resolve) => setTimeout(() => resolve("streamed content"), 300));
  return <p class="slow">{text}</p>;
}
export default function Stream() {
  return (
    <main>
      <h1>Query {url().searchParams.get("q")}</h1>
      <Suspense fallback={<p class="fallback">Loading</p>}>
        <Slow />
      </Suspense>
    </main>
  );
}
`,
  "src/routes/api/hello/route.ts": `export const mode = "server";
export const GET = (ctx: { url: URL }) => Response.json({ hello: ctx.url.searchParams.get("name") });
`,
  "src/routes/form/page.stsx": `import { actionData, fail, type Action } from "lumiose";
export const mode = "server";
export const action: Action = async (ctx) => {
  const name = String((await ctx.formData()).get("name") ?? "");
  return name === "" ? fail(400, { message: "Name required" }) : { message: \`Hello, \${name}!\` };
};
export default function Form() {
  const data = actionData<{ message: string }>();
  return <p class="result">{data?.message ?? "none"}</p>;
}
`,
  "src/components/Counter.stsx": `import { signal } from "lumiose";
import { format } from "../lib/format.ts";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <button onClick={() => count.update((n) => n + 1)}>{format(count())}</button>;
}
`,
  "src/lib/format.ts": `export const format = (n: number): string => String(n);
`,
  "src/routes/island/page.stsx": `import { Counter } from "../../components/Counter.stsx";
export const mode = "server";
export default function IslandPage() {
  return <main><Counter client:load start={3} /></main>;
}
`,
  "src/lib/visits.ts": `import { defineState, signal } from "lumiose";
export const visits = defineState(() => ({ count: signal(import.meta.env.SSR ? 7 : 0) }));
`,
  "src/lib/note.ts": `import { defineState, signal } from "lumiose";
export const note = defineState(() => ({ text: signal("server only") }));
`,
  "src/components/Visits.stsx": `import { visits } from "../lib/visits.ts";
export function Visits() {
  const { count } = visits();
  return <b onClick={() => count.update((n) => n + 1)}>{count()} visits</b>;
}
`,
  "src/routes/state/page.stsx": `import { Visits } from "../../components/Visits.stsx";
import { note } from "../../lib/note.ts";
import { visits } from "../../lib/visits.ts";
export const mode = "server";
export default function StatePage() {
  return <main><p>{note().text()} {visits().count()}</p><Visits client:load /></main>;
}
`,
  "src/routes/boom/page.stsx": `export const mode = "server";
export default function Boom() {
  throw new Error("Boom from the page");
}
`,
  "src/routes/caught/page.stsx": `import { ErrorBoundary } from "lumiose";
export const mode = "server";
function Broken(): JSX.Element {
  throw new Error("Caught by a boundary");
}
export default function Caught() {
  return (
    <ErrorBoundary fallback={(error: Error) => <p class="caught">{error.message}</p>}>
      <Broken />
    </ErrorBoundary>
  );
}
`,
  "src/instrumentation.server.ts": INSTRUMENTATION("v1"),
};

/** `src/instrumentation.server.ts`, logging to `globalThis` (the module runner shares it). */
function INSTRUMENTATION(version: string): string {
  return `const log: string[] = ((globalThis as any).lumioseInstrumentationLog ??= []);
export function register() {
  log.push("register ${version}");
}
export function onRequestError(error: unknown, info: { phase: string; route?: string }) {
  log.push(\`\${info.phase} \${info.route} \${(error as Error).message}\`);
}
`;
}

const instrumentationLog = (): string[] =>
  ((globalThis as { lumioseInstrumentationLog?: string[] }).lumioseInstrumentationLog ??= []);

const lumioseRoot = LUMIOSE_ROOT;
let root: string;
let dev: DevServer;
const sent: HotPayload[] = [];
const errors: string[] = [];

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-dev-")));
  for (const [name, code] of Object.entries(FILES)) write(name, code);
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  const logger = createLogger("silent");
  logger.error = (message) => void errors.push(message);
  dev = await createDevServer({ root, port: 0, customLogger: logger });
  const hot = dev.vite.environments.client.hot;
  const send = hot.send.bind(hot);
  hot.send = ((payload: HotPayload) => {
    sent.push(payload);
    send(payload);
  }) as typeof hot.send;
});

afterAll(async () => {
  await dev?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  sent.length = 0;
  errors.length = 0;
});

function write(name: string, code: string): void {
  mkdirSync(dirname(join(root, name)), { recursive: true });
  writeFileSync(join(root, name), code);
}

function get(path: string, init?: RequestInit): Promise<Response> {
  return fetch(new URL(path, dev.url), init);
}

async function eventually(check: () => Promise<boolean> | boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting for the dev server.");
    await new Promise((done) => setTimeout(done, 50));
  }
}

/** Waits until the watcher is quiet (late events of earlier edits), then forgets what was sent. */
async function settle(quiet = 300): Promise<void> {
  let count = -1;
  while (count !== sent.length) {
    count = sent.length;
    await new Promise((done) => setTimeout(done, quiet));
  }
  sent.length = 0;
}

describe.skipIf(!binding)("lumiose dev", () => {
  it("renders static routes fully resolved, with Vite's client and the route's stylesheets", async () => {
    const response = await get("/");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<title>Home</title>");
    expect(html).toContain('<script type="module" src="/@vite/client"></script>');
    expect(html).toContain('<script type="module" src="/@id/__x00__lumiose:dev"></script>');
    expect(html).toMatch(
      /<link rel="stylesheet" href="\/src\/styles\.css" data-vite-dev-id="[^"]*\/src\/styles\.css">/,
    );
    expect(html).toContain(
      "<div class=layout><main><h1>Home</h1><p class=slow>slow content</p></main></div>",
    );
    expect(html).not.toContain("<?start");
    // lumiose({ prefetch }) defaults to "hover" (endpoints excepted); viewTransitions to false.
    expect(html).toContain(
      '<script type="speculationrules">{"prefetch":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/api/hello{/}?"]}}]},"eagerness":"moderate"}]}</script>',
    );
    expect(html).not.toContain("@view-transition");
  });

  it("streams Suspense boundaries of server routes after the shell", async () => {
    const response = await get("/stream?q=lumiose");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain("<h1>Query lumiose</h1>");
    expect(first).toContain('<?start name="lb0"><p class=fallback>Loading</p><?end>');
    expect(first).not.toContain("streamed content");
    let rest = "";
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain('<template for="lb0"><p class=slow>streamed content</p></template>');
    // The dev annotation follows (TASK-148).
    expect(rest).toMatch(
      /<\/body><\/html><script type="application\/json" data-l-dev>[^<]*<\/script>$/,
    );
  });

  it("ends HTML pages with their dev annotation and loads the dev client (TASK-148)", async () => {
    const html = await (await get("/island")).text();
    const json = /<script type="application\/json" data-l-dev>([^<]*)<\/script>$/.exec(html);
    expect(JSON.parse(json![1]!)).toEqual({
      method: "GET",
      status: 200,
      errors: false,
      shell: expect.any(String),
      islands: expect.any(String),
    });
    const entry = await (await get("/@id/__x00__lumiose:dev")).text();
    const source = /import "(\/@fs\/[^"]+\/app\/dev\/client\.ts)"/.exec(entry);
    expect(source).not.toBeNull();
    const client = await get(source![1]!);
    expect(client.status).toBe(200);
    const code = await client.text();
    expect(code).toContain("lumiose:server-update");
    expect(code).toMatch(/import .* from "[^"]*\/app\/dev\/morph\.ts"/);
  });

  it("mounts the in-page inspector from the dev client, and has the runtime report to it (decision-59)", async () => {
    const entry = await (await get("/@id/__x00__lumiose:dev")).text();
    const mount =
      /import \{ mountInspector \} from "(\/@fs\/[^"]+\/app\/dev\/inspector\.ts)";\nmountInspector\((.*)\);/.exec(
        entry,
      );
    expect(mount).not.toBeNull();
    expect(JSON.parse(mount![2]!)).toEqual({ root: normalizePath(root), base: "/" });
    const inspector = await get(mount![1]!);
    expect(inspector.status).toBe(200);
    expect(await inspector.text()).toContain("lumiose-inspector");
    const fsPath = normalizePath(lumioseRoot).replace(/^\//, "");
    const flag = await (await get(`/@fs/${fsPath}/src/dom/dev.ts`)).text();
    expect(flag).toContain('"LUMIOSE_INSPECTOR": true');
  });

  it("serves Lumiose modules to the browser from the client environment (islands, SPA)", async () => {
    const response = await get("/src/routes/form/page.stsx?import");
    const code = await response.text();
    expect(response.headers.get("content-type")).toMatch(/javascript/);
    expect(code).toContain("/packages/lumiose/src/dom/index.ts");
    expect(code).not.toContain("lumiose/server");
  });

  it("sends the scoped state islands reach, not the server-only state (TASK-193)", async () => {
    const html = await (await get("/state")).text();
    expect(html).toContain("<p>server only 7</p>");
    const payload = /<script type="application\/json" data-l-payload>(.*?)<\/script>/.exec(html);
    expect(JSON.parse(payload![1]!)).toEqual({ s: { "/src/lib/visits.ts#visits": { count: 7 } } });
    expect(html.indexOf(payload![0])).toBeLessThan(html.indexOf("data-l-islands"));
    // The browser's module carries the same id.
    const client = await (await get("/src/lib/visits.ts")).text();
    expect(client).toContain('visits.$$id = "/src/lib/visits.ts#visits";');
  });

  it("renders islands with their records and dev module URLs", async () => {
    const html = await (await get("/island")).text();
    expect(html).toContain('<link rel="modulepreload" href="/src/components/Counter.stsx?import"');
    expect(html).toMatch(/<!--l:0-->.*<button>.*3.*<\/button>.*<!--\/l:0-->/);
    expect(html).toContain('"ref":"/src/components/Counter.stsx#Counter"');
    // The island loader: a virtual module importing lumiose's source, which imports the manifest.
    expect(html).toContain(
      '<script type="module" async src="/@id/__x00__lumiose:loader"></script>',
    );
    const entry = await (await get("/@id/__x00__lumiose:loader")).text();
    const source = /import "(\/@fs\/[^"]+\/dom\/loader\.ts)"/.exec(entry);
    expect(source).not.toBeNull();
    const loader = await get(source![1]!);
    expect(loader.status).toBe(200);
    expect(await loader.text()).toContain("lumiose:islands");
  });

  it("serves endpoints", async () => {
    const response = await get("/api/hello?name=dev");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual({ hello: "dev" });
  });

  it("runs form actions and re-renders with their data", async () => {
    const origin = new URL(dev.url).origin;
    const post = (name: string) =>
      get("/form", { method: "POST", headers: { origin }, body: new URLSearchParams({ name }) });
    const ok = await post("Ada");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("<p class=result>Hello, Ada!</p>");
    const failed = await post("");
    expect(failed.status).toBe(400);
    expect(await failed.text()).toContain("<p class=result>Name required</p>");
  });

  it("shows render errors in Vite's overlay, with a code frame of the throwing line", async () => {
    // Node source-maps stacks of modules run by Vite's module runner unless something overrides
    // Error.prepareStackTrace, as Vitest does: restore Node's own formatting for this request.
    const prepare = Error.prepareStackTrace;
    delete (Error as { prepareStackTrace?: unknown }).prepareStackTrace;
    let response: Response;
    try {
      response = await get("/boom");
    } finally {
      Error.prepareStackTrace = prepare;
    }
    const html = await response.text();
    expect(response.status).toBe(500);
    expect(html).toContain('import { ErrorOverlay } from "/@vite/client"');
    const overlay = JSON.parse(
      html.slice(html.indexOf("new ErrorOverlay(") + 17, html.lastIndexOf("));</script>")),
    );
    expect(overlay.message).toBe("Boom from the page");
    expect(overlay.loc).toEqual({
      file: join(root, "src/routes/boom/page.stsx"),
      line: 3,
      column: expect.any(Number),
    });
    expect(overlay.frame).toContain('3  |    throw new Error("Boom from the page");');
    expect(errors.join("\n")).toContain("Boom from the page");
  });

  it("loads src/instrumentation.server.ts: register() once, onRequestError() for errors, caught ones too (TASK-298)", async () => {
    await get("/boom");
    const caught = await get("/caught");
    expect(await caught.text()).toContain("<p class=caught>Caught by a boundary</p>");
    const log = instrumentationLog();
    expect(log.filter((entry) => entry.startsWith("register"))).toEqual(["register v1"]);
    expect(log).toContain("render /boom Boom from the page");
    expect(log).toContain("render /caught Caught by a boundary");
    // An edit loads the new file, which registers again.
    write("src/instrumentation.server.ts", INSTRUMENTATION("v2"));
    await eventually(async () => {
      await get("/api/hello");
      return log.includes("register v2");
    });
    await settle();
  });

  it("re-renders edited server modules on the next request and has the page patch itself", async () => {
    const file = "src/routes/page.stsx";
    const source = FILES[file]!;
    write(file, source.replace("<h1>Home</h1>", "<h1>Edited</h1>"));
    await eventually(async () => (await (await get("/")).text()).includes("<h1>Edited</h1>"));
    await eventually(() => sent.some((payload) => payload.type === "custom"));
    expect(sent).toContainEqual({ type: "custom", event: "lumiose:server-update" });
    expect(sent).not.toContainEqual({ type: "full-reload", path: "*" });

    sent.length = 0;
    write(file, source.replace("<h1>Home</h1>", "<h1>Broken</h2>"));
    await eventually(async () => (await get("/")).status === 500);
    const html = await (await get("/")).text();
    expect(html).toContain("LUM1001");
    expect(html).toContain('"plugin":"lumiose"');
    expect(html).toContain('"frame":');
    write(file, source);
    await eventually(async () => (await get("/")).status === 200);
  });

  it("updates the browser once when one save reaches the watcher as several changes", async () => {
    const file = "src/routes/page.stsx";
    const source = FILES[file]!;
    write(file, source.replace("<h1>Home</h1>", "<h1>Twice</h1>"));
    await eventually(async () => (await (await get("/")).text()).includes("<h1>Twice</h1>"));
    await settle();
    // One save seen as a burst of events (a truncate, then the write; an editor that writes
    // twice). Emitted directly, so no late event of the real file system joins the count.
    for (let i = 0; i < 3; i++) dev.vite.watcher.emit("change", join(root, file));
    await eventually(() => sent.length > 0);
    await new Promise((done) => setTimeout(done, 200));
    expect(sent).toEqual([{ type: "custom", event: "lumiose:server-update" }]);
    write(file, source);
    await eventually(async () => (await (await get("/")).text()).includes("<h1>Home</h1>"));
  });

  it("reloads the browser after edits to client code (TASK-148)", async () => {
    // A module the island imports: the island's instances would keep its old exports.
    await get("/island");
    await settle();
    const file = "src/lib/format.ts";
    write(file, FILES[file]!.replace("String(n)", "`${n}!`"));
    await eventually(() => sent.length > 0);
    await new Promise((done) => setTimeout(done, 100));
    expect(sent).toEqual([{ type: "full-reload", path: "*" }]);
    write(file, FILES[file]!);
  });

  it("swaps stylesheets in place when only CSS changed", async () => {
    await get("/");
    await settle();
    write("src/styles.css", "body { color: rgb(4, 5, 6); }\n");
    await eventually(() => sent.some((payload) => payload.type === "update"));
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: "update",
        updates: [expect.objectContaining({ type: "css-update", path: "/src/styles.css" })],
      }),
    );
    expect(sent).not.toContainEqual({ type: "full-reload", path: "*" });
  });

  it("picks up added and removed routes, and regenerates the route types", async () => {
    write(
      "src/routes/added/page.stsx",
      "export default function Added() { return <p>added</p>; }\n",
    );
    await eventually(async () => (await get("/added")).status === 200);
    expect(await (await get("/added")).text()).toContain("<p>added</p>");
    expect(readFileSync(join(root, ".lumiose/types/routes.d.ts"), "utf8")).toContain('"/added"');
    expect(sent).toContainEqual({ type: "full-reload", path: "*" });

    rmSync(join(root, "src/routes/added/page.stsx"));
    await eventually(async () => (await get("/added")).status === 404);
    expect(readFileSync(join(root, ".lumiose/types/routes.d.ts"), "utf8")).not.toContain(
      '"/added"',
    );
  });

  it("loads src/instrumentation.client.ts on every page, timed, and the loader waits for it (TASK-295)", async () => {
    const tag = '<script type="module" src="/@id/__x00__lumiose:client" data-l-client></script>';
    write("src/instrumentation.client.ts", "export const onError = () => {};\n");
    await eventually(async () => (await (await get("/")).text()).includes(tag));
    expect(await (await get("/island")).text()).toContain(tag);
    const client = await (await get("/@id/__x00__lumiose:client")).text();
    expect(client).toContain("/src/instrumentation.client.ts");
    expect(client).toContain("performance.now() - start");
    expect(client).toContain("Keep it under 16 ms");
    const loader = await (await get("/@id/__x00__lumiose:loader")).text();
    expect(loader).toContain("app/client-loader.ts");

    rmSync(join(root, "src/instrumentation.client.ts"));
    await eventually(async () => !(await (await get("/")).text()).includes("data-l-client"));
    expect(await (await get("/@id/__x00__lumiose:loader")).text()).toContain("dom/loader.ts");
    await settle();
  });

  it("shows route manifest errors on every page until they are fixed", async () => {
    write(
      "src/routes/stream/page.tsx",
      "export default function Clash() { return <p>clash</p>; }\n",
    );
    await eventually(async () => (await (await get("/")).text()).includes("LUM5003"));
    rmSync(join(root, "src/routes/stream/page.tsx"));
    await eventually(async () => !(await (await get("/")).text()).includes("LUM5003"));
  });
});

describe.skipIf(!binding)("lumiose dev below a base (TASK-101)", () => {
  let site: string;
  let server: DevServer;

  beforeAll(async () => {
    if (!binding) return;
    site = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-dev-base-")));
    const files: Record<string, string> = {
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { base: "/sub/", plugins: [lumiose({ trailingSlash: "always", inspector: false })] };
`,
      "src/routes/page.stsx": `import { href } from "lumiose";
export default function Home() {
  return <main><a href={href("/blog/[slug]", { slug: "hello" })}>Post</a><a href={href("/")}>Home</a></main>;
}
`,
      "src/routes/blog/[slug]/page.stsx": `export default function Post() { return <h1>Post</h1>; }
`,
    };
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(dirname(join(site, name)), { recursive: true });
      writeFileSync(join(site, name), code);
    }
    mkdirSync(join(site, "node_modules"));
    linkLumiose(site);
    server = await createDevServer({ root: site, port: 0, customLogger: createLogger("silent") });
  });

  afterAll(async () => {
    await server?.close();
    if (site) rmSync(site, { recursive: true, force: true });
  });

  it("renders href() links with the base and the trailing-slash policy, and serves both to the client", async () => {
    const html = await (await fetch(new URL("/sub/", server.url))).text();
    expect(html).toContain('<a href="/sub/blog/hello/">Post</a><a href="/sub/">Home</a>');
    // The browser's copy of href() gets the same values: the base from Vite's import.meta.env,
    // the policy from the global define @vite/env sets.
    // `/@fs/` + the absolute path with forward slashes (`/@fs/C:/…` on Windows).
    const fsPath = normalizePath(lumioseRoot).replace(/^\//, "");
    const module = await fetch(new URL(`/sub/@fs/${fsPath}/src/app/routes/href.ts`, server.url));
    expect(module.status).toBe(200);
    const code = await module.text();
    expect(code).toContain('"BASE_URL": "/sub/"');
    const env = await (await fetch(new URL("/sub/@vite/env", server.url))).text();
    expect(env).toContain('"__LUMIOSE_TRAILING_SLASH__": "always"');
  });

  it("leaves the inspector out with lumiose({ inspector: false })", async () => {
    const entry = await (await fetch(new URL("/sub/@id/__x00__lumiose:dev", server.url))).text();
    expect(entry).toContain("/app/dev/client.ts");
    expect(entry).not.toContain("mountInspector");
    const fsPath = normalizePath(lumioseRoot).replace(/^\//, "");
    const flag = await (
      await fetch(new URL(`/sub/@fs/${fsPath}/src/dom/dev.ts`, server.url))
    ).text();
    expect(flag).toContain("import.meta.env = {");
    expect(flag).not.toContain('"LUMIOSE_INSPECTOR": true');
  });
});
