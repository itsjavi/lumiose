// `lumiose` CLI smoke tests (TASK-28): every command runs on a fixture app (written to a temp dir
// whose node_modules link lumiose, TypeScript and @lumiose/adapter-node), with its help,
// `--format json` envelope and exit code. Commands that only compute an answer run in-process through
// `main` (TASK-262: a cold start of the bin per call made these tests time out under full-suite
// load); the bin's own wiring, the tools it shells out to and the servers run as subprocesses.
import { linkLumiose } from "@lumiose/vite/internal/test-links.ts";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from "vitest";
import { tsconfigTemplate } from "./check/tsconfig.ts";
import { main, suggest } from "./main.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "..");
const bin = join(packageDir, "src/bin.ts");
const binding = await import("@lumiose/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "cli-fixture", private: true, type: "module" }),
  "tsconfig.json": JSON.stringify(tsconfigTemplate(), null, 2),
  // The project default is `server`, so the endpoint may take POST (static endpoints may not).
  "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "server" })] };
`,
  "src/components/Card.stsx": `export function Card(props: { title: string }) {
  return (
    <section class="card">
      <h2>{props.title}</h2>
      <style>
        .card {
          padding: 1rem;
        }
      </style>
    </section>
  );
}
`,
  "src/routes/layout.stsx": `export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}</div>;
}
`,
  "src/routes/page.stsx": `import { Card } from "../components/Card.stsx";
export const mode = "static";
export default function Home() {
  return <main><Card title="Home" /></main>;
}
`,
  "src/routes/about/page.stsx": `export default function About() {
  return <main><h1>About</h1></main>;
}
`,
  "src/routes/api/hello/route.ts": `export const GET = () => Response.json({ hello: "world" });
export const POST = () => new Response(null, { status: 204 });
`,
};

let root: string;
beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-")));
  for (const [name, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  const require = createRequire(import.meta.url);
  mkdirSync(join(root, "node_modules/@lumiose"), { recursive: true });
  linkLumiose(root);
  symlinkSync(
    dirname(require.resolve("typescript/package.json")),
    join(root, "node_modules/typescript"),
    "dir",
  );
  symlinkSync(
    join(packageDir, "../adapter-node"),
    join(root, "node_modules/@lumiose/adapter-node"),
    "dir",
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function start(args: string[], cwd = root): ChildProcess {
  return spawn(process.execPath, [bin, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined },
  });
}

/** Runs the CLI in this process, as bin.ts does, in the fixture app without colors. */
async function run(...args: string[]): Promise<Run> {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    cwd: root,
    color: false,
    write: (text) => void (stdout += text),
    writeError: (text) => void (stderr += text),
  });
  return { code, stdout, stderr };
}

/** Runs the bin as a subprocess: a cold Node start per call, so tests give it a longer timeout. */
function runBin(...args: string[]): Promise<Run> {
  return runBinIn(root, ...args);
}

function runBinIn(cwd: string, ...args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = start(args, cwd);
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk) => (stdout += chunk));
    child.stderr!.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function runJson(...args: string[]) {
  return withJson(await run(...args, "--format", "json"));
}

async function runBinJson(...args: string[]) {
  return withJson(await runBin(...args, "--format", "json"));
}

function withJson(result: Run) {
  return { ...result, json: JSON.parse(result.stdout) as Record<string, any> };
}

/** Starts a server command with `--format json --port 0`, reads its JSON line, then stops it. */
async function serve(command: string, use: (url: string) => Promise<void>, cwd = root) {
  const child = start([command, "--format", "json", "--port", "0"], cwd);
  let stderr = "";
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  const closed = new Promise<number | null>((resolve) => child.on("close", resolve));
  try {
    const line = await new Promise<string>((resolve, reject) => {
      let stdout = "";
      child.stdout!.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.includes("\n")) resolve(stdout.slice(0, stdout.indexOf("\n")));
      });
      child.on("close", (code) => reject(new Error(`${command} exited (${code}): ${stderr}`)));
    });
    const envelope = JSON.parse(line) as { command: string; ok: boolean; url: string };
    expect(envelope).toMatchObject({ command, ok: true });
    await use(envelope.url);
  } finally {
    child.kill("SIGTERM");
  }
  // Vite's dev server exits with 128 + 15 on SIGTERM; on Windows the process is terminated
  // without an exit code (null).
  expect(process.platform === "win32" ? [0, 143, null] : [0, 143]).toContain(await closed);
}

/** The CSS modules test page, importing from `components`. */
function cssModulesPage(components: string) {
  return `import { Tile } from "${components}/Tile.tsx";
import styles from "${components}/Tile.module.css";
export default function Page() {
  return (
    <main>
      <p class={styles.tile}>Server only</p>
      <Tile client:load active class="extra" />
    </main>
  );
}
`;
}

/** The classes of the CSS modules test page's server-only `<p>` and island `<button>`. */
function pageClasses(html: string) {
  return {
    paragraph: /<p class="([^"]*)">Server only/.exec(html)?.[1],
    button: /<button class="([^"]*)">/.exec(html)?.[1],
  };
}

describe("lumiose CLI", () => {
  it(
    "the bin writes stdout and stderr and sets the exit code",
    // Two cold starts of the bin, run concurrently: about 0.2 s on an idle machine, several seconds
    // when the whole suite shares the CPU.
    { timeout: 30_000 },
    async () => {
      const [version, typo] = await Promise.all([runBin("-v"), runBin("chek")]);
      expect(version.code).toBe(0);
      expect(version.stdout).toMatch(/^lumiose \d+\.\d+\.\d+\n$/);
      expect(typo.code).toBe(2);
      expect(typo.stdout).toBe("");
      expect(typo.stderr).toContain('Unknown command "chek".');
    },
  );

  it("prints help, per-command help, JSON help and the version", async () => {
    const help = await run("--help");
    expect(help.code).toBe(0);
    for (const command of [
      "dev",
      "build",
      "preview",
      "check",
      "typegen",
      "routes",
      "lint",
      "fmt",
      "docs",
      "explain",
    ]) {
      expect(help.stdout).toMatch(new RegExp(`^  ${command}\\b`, "m"));
    }
    const routes = await run("routes", "--help");
    expect(routes.stdout).toMatch(/^Usage: lumiose routes \[options\]/);
    expect(routes.stdout).toContain("Exit codes:");
    expect((await run("help", "fmt")).stdout).toContain("--check");

    const json = await runJson("help");
    expect(json.json.commands.map((command: { name: string }) => command.name)).toContain(
      "typegen",
    );
    expect((await runJson("help", "check")).json).toMatchObject({
      command: "help",
      ok: true,
      name: "check",
      usage: "lumiose check [options]",
    });
    expect((await runJson("--version")).json).toMatchObject({ command: "version", ok: true });
    expect((await run("-v")).stdout).toMatch(/^lumiose \d+\.\d+\.\d+/);
  });

  it("suggests commands for typos and reports misuse with exit code 2", async () => {
    const typo = await run("chek");
    expect(typo.code).toBe(2);
    expect(typo.stderr).toContain('Unknown command "chek".\nDid you mean "lumiose check"?');
    const json = await runJson("rotues");
    expect(json.code).toBe(2);
    expect(json.json).toMatchObject({ command: "rotues", ok: false, suggestions: ["routes"] });

    const misuse = await runJson("check", "--port", "3000");
    expect(misuse.code).toBe(2);
    expect(misuse.json.failure.message).toBe(
      "--port does not apply to check (only to dev, preview).",
    );
    expect((await run("routes", "extra")).code).toBe(2);
    expect((await run("check", "--format", "xml")).code).toBe(2);
    expect((await run("check", "--nope")).code).toBe(2);
    expect((await run("dev", "--port", "http")).code).toBe(2);
  });

  it("does not exit 2 for unknown commands that are not close to any", () => {
    expect(suggest("zzz", ["check", "routes"])).toEqual([]);
    expect(suggest("biuld", ["build", "check"])).toEqual(["build"]);
    expect(suggest("type", ["typegen", "build"])).toEqual(["typegen"]);
  });

  it("lumiose routes prints the table and JSON with modes from lumiose({ mode })", async () => {
    const table = await run("routes");
    expect(table.code).toBe(0);
    expect(table.stdout).toContain(
      "Routes in src/routes (default mode: server): 2 pages, 1 endpoint",
    );
    expect(table.stdout).toMatch(/^\/\s+page\s+static\s+page\.stsx\s+layout\.stsx$/m);
    expect(table.stdout).toMatch(/^\/about\s+page\s+server\s+about\/page\.stsx\s+layout\.stsx$/m);
    expect(table.stdout).toMatch(/^\/api\/hello\s+endpoint\s+server\s+api\/hello\/route\.ts$/m);

    const { code, json } = await runJson("routes", "--root", root);
    expect(code).toBe(0);
    expect(json).toMatchObject({
      command: "routes",
      ok: true,
      defaultMode: "server",
      diagnostics: [],
    });
    expect(json.routes).toContainEqual({
      pattern: "/",
      file: "src/routes/page.stsx",
      kind: "page",
      mode: "static",
      ssr: true,
      prerender: false,
      layouts: ["src/routes/layout.stsx"],
      middleware: [],
      params: [],
    });
  });

  it("lumiose routes marks spa pages prerendered by lumiose({ prerender }) and shells", async () => {
    // A separate project, so that its routes stay out of the shared fixture's `check`.
    const project = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-spa-")));
    onTestFinished(() => rmSync(project, { recursive: true, force: true }));
    symlinkSync(join(root, "node_modules"), join(project, "node_modules"), "dir");
    const files: Record<string, string> = {
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "spa", prerender: true })] };
`,
      "src/routes/page.stsx": `export default function Home() {
  return <main>Home</main>;
}
`,
      "src/routes/editor/page.stsx": `export const ssr = false;
export default function Editor() {
  return <main>Editor</main>;
}
`,
    };
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(project, name)), { recursive: true });
      writeFileSync(join(project, name), text);
    }
    const table = await run("routes", "--root", project);
    expect(table.code).toBe(0);
    expect(table.stdout).toMatch(/^\/\s+page\s+spa \(prerendered\)\s+page\.stsx$/m);
    expect(table.stdout).toMatch(/^\/editor\s+page\s+spa \(shell\)\s+editor\/page\.stsx$/m);

    const { json } = await runJson("routes", "--root", project);
    expect(json.routes).toEqual([
      expect.objectContaining({ pattern: "/", mode: "spa", ssr: true, prerender: true }),
      expect.objectContaining({ pattern: "/editor", mode: "spa", ssr: false, prerender: false }),
    ]);
  });

  it("lumiose routes lists the locales each route declares with lumiose({ i18n })", async () => {
    const project = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-i18n-")));
    onTestFinished(() => rmSync(project, { recursive: true, force: true }));
    symlinkSync(join(root, "node_modules"), join(project, "node_modules"), "dir");
    const files: Record<string, string> = {
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ i18n: { locales: ["en", "es", "fr"], defaultLocale: "en" } })] };
`,
      "src/routes/page.stsx": `export const locales = "all";
export default function Home() {
  return <main>Home</main>;
}
`,
      "src/routes/about/page.stsx": `export default function About() {
  return <main>About</main>;
}
`,
      "src/routes/blog/[slug]/page.stsx": `export async function locales() {
  return ["en", "es"];
}
export default function Post() {
  return <main>Post</main>;
}
`,
    };
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(project, name)), { recursive: true });
      writeFileSync(join(project, name), text);
    }
    const table = await run("routes", "--root", project);
    expect(table.code).toBe(0);
    expect(table.stdout).toContain(
      "Routes in src/routes (default mode: static, locales: en, es, fr (default en)): 3 pages",
    );
    expect(table.stdout).toMatch(/^PATTERN\s+KIND\s+MODE\s+FILE\s+LOCALES\s+LAYOUTS$/m);
    expect(table.stdout).toMatch(/^\/\s+page\s+static\s+page\.stsx\s+en, es, fr$/m);
    expect(table.stdout).toMatch(/^\/about\s+page\s+static\s+about\/page\.stsx\s+en$/m);
    expect(table.stdout).toMatch(
      /^\/blog\/\[slug\]\s+page\s+static\s+blog\/\[slug\]\/page\.stsx\s+locales\(\) in blog\/\[slug\]\/page\.stsx$/m,
    );

    const { json } = await runJson("routes", "--root", project);
    expect(json.i18n).toEqual({ locales: ["en", "es", "fr"], defaultLocale: "en" });
    expect(json.routes).toEqual([
      expect.objectContaining({ pattern: "/", locales: ["en", "es", "fr"] }),
      expect.objectContaining({ pattern: "/about", locales: ["en"] }),
      expect.objectContaining({
        pattern: "/blog/[slug]",
        localesFrom: "src/routes/blog/[slug]/page.stsx",
      }),
    ]);
    expect(json.routes[2]).not.toHaveProperty("locales");
  });

  it("lumiose routes prints each route's middleware chain and warns about prerendered ones", async () => {
    const project = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-middleware-")));
    onTestFinished(() => rmSync(project, { recursive: true, force: true }));
    symlinkSync(join(root, "node_modules"), join(project, "node_modules"), "dir");
    const files: Record<string, string> = {
      "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "server" })] };
`,
      "src/middleware.ts": "export default (ctx, next) => next();\n",
      "src/routes/page.stsx": "export default function Home() {\n  return <main>Home</main>;\n}\n",
      "src/routes/admin/middleware.ts": "export default (ctx, next) => next();\n",
      "src/routes/admin/users/middleware.ts": "export default (ctx, next) => next();\n",
      "src/routes/admin/users/page.stsx":
        "export default function Users() {\n  return <main>Users</main>;\n}\n",
      "src/routes/admin/docs/page.stsx":
        'export const mode = "static";\nexport default function Docs() {\n  return <main>Docs</main>;\n}\n',
    };
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(project, name)), { recursive: true });
      writeFileSync(join(project, name), text);
    }
    const table = await run("routes", "--root", project);
    expect(table.code).toBe(0);
    expect(table.stdout).toMatch(/^PATTERN\s+KIND\s+MODE\s+FILE\s+MIDDLEWARE\s+LAYOUTS$/m);
    expect(table.stdout).toMatch(/^\/\s+page\s+server\s+page\.stsx\s+src\/middleware\.ts$/m);
    expect(table.stdout).toMatch(
      /^\/admin\/users\s+page\s+server\s+admin\/users\/page\.stsx\s+src\/middleware\.ts > admin\/middleware\.ts > admin\/users\/middleware\.ts$/m,
    );
    expect(table.stdout).toContain("LUM5008");

    const { json } = await runJson("routes", "--root", project);
    expect(json.routes).toEqual([
      expect.objectContaining({ pattern: "/", middleware: ["src/middleware.ts"] }),
      expect.objectContaining({
        pattern: "/admin/docs",
        middleware: ["src/middleware.ts", "src/routes/admin/middleware.ts"],
      }),
      expect.objectContaining({
        pattern: "/admin/users",
        middleware: [
          "src/middleware.ts",
          "src/routes/admin/middleware.ts",
          "src/routes/admin/users/middleware.ts",
        ],
      }),
    ]);
    expect(json.diagnostics).toEqual([
      expect.objectContaining({ code: "LUM5008", file: "src/routes/admin/middleware.ts" }),
    ]);
  });

  it("lumiose typegen writes the route types and the shadows", async () => {
    const { code, json } = await runJson("typegen", "--cwd", root);
    expect(code).toBe(0);
    expect(json).toMatchObject({
      command: "typegen",
      ok: true,
      routeTypes: { file: ".lumiose/types/routes.d.ts" },
      routes: 3,
      shadows: { dir: ".lumiose/shadow", files: 4 },
    });
    expect(existsSync(join(root, ".lumiose/types/routes.d.ts"))).toBe(true);
    expect(existsSync(join(root, ".lumiose/shadow/src/components/Card.stsx.tsx"))).toBe(true);
    expect((await run("typegen")).stdout).toMatch(
      /^Up to date: \.lumiose\/types\/routes\.d\.ts \(3 routes\)\./,
    );
  });

  it.skipIf(!binding)(
    "lumiose check, lint and fmt report in the envelope",
    async () => {
      const check = await runBinJson("check");
      expect(check.code, check.stderr).toBe(0);
      expect(check.json).toMatchObject({ command: "check", ok: true, diagnostics: [] });

      const lint = await runBinJson("lint");
      expect(lint.json).toMatchObject({ command: "lint", ok: lint.code === 0 });

      const fmt = await runBinJson("fmt", "--check", "src/components");
      expect(fmt.json).toMatchObject({
        command: "fmt",
        ok: fmt.code === 0,
        check: true,
        summary: { files: 1, errors: 0 },
      });
      // Three CLI runs, one of them a full TypeScript check: seconds on a CI runner.
    },
    60_000,
  );

  it("lumiose docs and explain answer in the envelope", async () => {
    expect((await runJson("docs", "signals")).json).toMatchObject({
      command: "docs",
      ok: true,
      topic: "concepts/signals",
    });
    const missing = await runJson("docs", "zzqqxx");
    expect(missing.code).toBe(1);
    expect(missing.json).toMatchObject({ command: "docs", ok: false, results: [] });
    expect((await runJson("explain", "LUM1006")).json).toMatchObject({
      command: "explain",
      ok: true,
      code: "LUM1006",
    });
  });

  it.skipIf(!binding)(
    "lumiose build, preview and dev run with JSON on stdout",
    { timeout: 60_000 },
    async () => {
      const build = await runBinJson("build");
      expect(build.code, build.stderr).toBe(0);
      expect(build.json).toMatchObject({ command: "build", ok: true, clientDir: "dist/client" });
      expect(build.json.prerendered).toContainEqual(
        expect.objectContaining({ path: "/", file: "index.html", kind: "page" }),
      );

      await serve("preview", async (url) => {
        expect(await (await fetch(new URL("/about", url))).text()).toContain("<h1>About</h1>");
        expect(await (await fetch(new URL("/api/hello", url))).json()).toEqual({ hello: "world" });
      });
      await serve("dev", async (url) => {
        const home = await fetch(url);
        expect(home.status).toBe(200);
        expect(await home.text()).toMatch(/<h2[^>]*>Home<\/h2>/);
      });
    },
  );
  it.skipIf(!binding)(
    "CSS modules render the same hashed classes on the server and in the browser (TASK-334)",
    { timeout: 60_000 },
    async () => {
      const project = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-css-modules-")));
      onTestFinished(() => rmSync(project, { recursive: true, force: true }));
      symlinkSync(join(root, "node_modules"), join(project, "node_modules"), "dir");
      const files: Record<string, string> = {
        "package.json": JSON.stringify({ name: "css-modules", private: true, type: "module" }),
        "tsconfig.json": JSON.stringify(tsconfigTemplate(), null, 2),
        "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose()] };
`,
        "src/components/Tile.module.css": ".tile { padding: 1rem; }\n.active { color: crimson; }\n",
        "src/components/Tile.tsx": `import { signal } from "lumiose";
import styles from "./Tile.module.css";
export function Tile(props: { active: boolean; class?: string }) {
  const on = signal(props.active);
  return (
    <button class={[styles.tile, on() && styles.active, props.class]} onClick={() => on.update((v) => !v)}>
      Tile
    </button>
  );
}
`,
        // A prerendered page and a page rendered per request.
        "src/routes/page.stsx": cssModulesPage("../components"),
        "src/routes/server/page.stsx": `export const mode = "server";\n${cssModulesPage("../../components")}`,
      };
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(dirname(join(project, name)), { recursive: true });
        writeFileSync(join(project, name), text);
      }
      const check = await runBinIn(project, "check", "--format", "json");
      expect(JSON.parse(check.stdout), check.stderr).toMatchObject({ ok: true, diagnostics: [] });

      const build = await runBinIn(project, "build", "--format", "json");
      expect(build.code, build.stderr).toBe(0);
      const built = pageClasses(readFileSync(join(project, "dist/client/index.html"), "utf8"));
      const [tile, active] = built.button?.split(" ") ?? [];
      expect(tile).toMatch(/^_tile_\w+$/);
      expect(active).toMatch(/^_active_\w+$/);
      expect(built).toEqual({ paragraph: tile, button: `${tile} ${active} extra` });
      // The browser's class map (the island's chunks) and the stylesheet use the same names.
      const assets = join(project, "dist/client/assets");
      const read = (suffix: string) =>
        readdirSync(assets)
          .filter((name) => name.endsWith(suffix))
          .map((name) => readFileSync(join(assets, name), "utf8"))
          .join("\n");
      for (const name of [tile, active]) {
        expect(read(".js")).toContain(`\`${name}\``);
        expect(read(".css")).toContain(`.${name}{`);
      }
      await serve(
        "preview",
        async (url) => {
          const html = await (await fetch(new URL("/server", url))).text();
          expect(pageClasses(html)).toEqual(built);
        },
        project,
      );
      await serve(
        "dev",
        async (url) => {
          const dev = pageClasses(await (await fetch(new URL("/server", url))).text());
          const [devTile, devActive] = dev.button?.split(" ") ?? [];
          expect(dev).toEqual({ paragraph: devTile, button: `${devTile} ${devActive} extra` });
          // The module the browser imports in dev maps the names to the same classes.
          const module = await (
            await fetch(new URL("/src/components/Tile.module.css?import", url))
          ).text();
          for (const name of [devTile, devActive]) {
            expect(module).toContain(`"${name}"`);
            expect(module).toContain(`.${name} {`);
          }
        },
        project,
      );
    },
  );
});
