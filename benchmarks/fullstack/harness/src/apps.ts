// The Tracker apps (doc-4 §3) and how to drive them: every app exposes the same package
// scripts (seed, dev, build, start, typecheck, clean) and listens on its fixed port.
import { type ChildProcess, spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FULLSTACK = fileURLToPath(new URL("../../", import.meta.url));
export const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

export type AppId =
  | "lumiose"
  | "react-router"
  | "next"
  | "solid-start"
  | "sveltekit"
  | "nuxt"
  | "remix";

export interface App {
  id: AppId;
  name: string;
  dir: string;
  port: number;
  /** Build output on disk, relative to `dir`. */
  clientOutput: string[];
  serverOutput: string[];
  /** HMR probe: a text in a shared component rendered in the footer of every page. */
  hmr: { file: string; find: string };
  /** Shared source packages the app's UI is built from, counted in its source size. */
  sharedSources: string[];
  /** Extra environment of every script the harness runs for this app. */
  env: Record<string, string>;
  /** The dev server's bundler, and the package whose version names it (resolved `via` another). */
  devTool: { name: string; pkg: string; via?: string };
  /** How the dev server and the production server serve the app (viewer, results meta). */
  devServer: string;
  prodServer: string;
  /**
   * How the issue page's comments reach the browser (doc-4 §5): streamed in the same response
   * (markup or data, the default), or fetched by the client after hydration, for a framework that
   * cannot stream a Suspense boundary (Nuxt renders to a string).
   */
  comments?: "streamed" | "client";
  /**
   * False for a framework without a production build (Remix 3 runs its sources and compiles
   * browser modules on request): its build time and output sizes are not recorded.
   */
  build?: false;
}

export const APPS: App[] = [
  {
    id: "lumiose",
    name: "Lumiose",
    dir: join(FULLSTACK, "apps/lumiose"),
    port: 4101,
    clientOutput: ["dist/client"],
    serverOutput: ["dist/server"],
    hmr: {
      file: join(FULLSTACK, "apps/lumiose/src/components/layout.tsx"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [],
    env: {},
    devTool: { name: "Vite", pkg: "vite", via: "lumiose" },
    devServer:
      "`lumiose dev`: Vite in middleware mode, modules compiled on request, SSR through Vite's module runner",
    prodServer:
      "`node server.ts`: the `lumiose build` output on @lumiose/adapter-node (compress: false)",
  },
  {
    id: "react-router",
    name: "React Router",
    dir: join(FULLSTACK, "apps/react-router"),
    port: 4102,
    clientOutput: ["build/client"],
    serverOutput: ["build/server"],
    hmr: {
      file: join(FULLSTACK, "packages/react-ui/src/layout.tsx"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [join(FULLSTACK, "packages/react-ui")],
    env: {},
    devTool: { name: "Vite", pkg: "vite" },
    devServer: "`react-router dev`: Vite dev server, modules compiled on request",
    prodServer:
      "`node server.ts`: Express + @react-router/express on the `react-router build` output, no compression middleware",
  },
  {
    id: "next",
    name: "Next.js",
    dir: join(FULLSTACK, "apps/next"),
    port: 4103,
    clientOutput: [".next/static"],
    serverOutput: [".next/server"],
    hmr: {
      file: join(FULLSTACK, "packages/react-ui/src/layout.tsx"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [join(FULLSTACK, "packages/react-ui")],
    env: { NEXT_TELEMETRY_DISABLED: "1" },
    devTool: { name: "Turbopack", pkg: "next" },
    devServer: "`next dev`: Turbopack dev server, routes compiled on first request",
    prodServer:
      "`next start`: Next's production server on the `next build` output (compress: false)",
  },
  {
    id: "solid-start",
    name: "SolidStart",
    dir: join(FULLSTACK, "apps/solid-start"),
    port: 4104,
    clientOutput: [".output/public"],
    serverOutput: [".output/server"],
    hmr: {
      file: join(FULLSTACK, "apps/solid-start/src/components/layout.tsx"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [],
    env: {},
    devTool: { name: "Vite", pkg: "vite" },
    devServer:
      "`vite dev`: Vite with SolidStart's plugin (Environment API), modules compiled on request",
    prodServer:
      "`node .output/server/index.mjs`: Nitro's node-server output of `vite build` (no compression)",
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    dir: join(FULLSTACK, "apps/sveltekit"),
    port: 4105,
    clientOutput: ["build/client"],
    serverOutput: ["build/server"],
    hmr: {
      file: join(FULLSTACK, "apps/sveltekit/src/routes/+layout.svelte"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [],
    env: {},
    devTool: { name: "Vite", pkg: "vite" },
    devServer: "`vite dev`: Vite with SvelteKit's plugin, modules compiled on request",
    prodServer:
      "`node build`: the @sveltejs/adapter-node output of `vite build` (precompress: false, no compression)",
  },
  {
    id: "nuxt",
    name: "Nuxt",
    dir: join(FULLSTACK, "apps/nuxt"),
    port: 4106,
    clientOutput: [".output/public"],
    serverOutput: [".output/server"],
    hmr: {
      file: join(FULLSTACK, "apps/nuxt/app/layouts/default.vue"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [],
    env: { NUXT_TELEMETRY_DISABLED: "1" },
    devTool: { name: "Vite", pkg: "vite", via: "nuxt" },
    devServer:
      "`nuxt dev`: Vite (Nuxt's Vite builder) with Nitro's dev server, modules compiled on request",
    prodServer:
      "`node .output/server/index.mjs`: Nitro's node-server output of `nuxt build` (no compression)",
    comments: "client",
  },
  {
    id: "remix",
    name: "Remix 3",
    dir: join(FULLSTACK, "apps/remix"),
    port: 4107,
    // No build step: the asset server compiles browser modules on request (nothing on disk).
    clientOutput: [],
    serverOutput: [],
    build: false,
    hmr: {
      file: join(FULLSTACK, "apps/remix/app/actions/document.tsx"),
      find: "fullstack comparison benchmark",
    },
    sharedSources: [],
    env: {},
    devTool: { name: "remix/assets", pkg: "@remix-run/assets", via: "remix" },
    devServer:
      "`node hmr.ts`: remix/node-hmr restarts the TypeScript server on changes and pushes browser updates; the asset server compiles browser modules on request",
    prodServer:
      "`node --import remix/node-tsx server.ts`: the same sources in production mode (no build step; browser modules compiled on first request, minified and fingerprinted; no compression)",
  },
];

export function appExists(app: App): boolean {
  return existsSync(join(app.dir, "package.json"));
}

export const baseUrl = (app: App): string => `http://127.0.0.1:${app.port}`;

/** Runs a package script to completion; returns its wall time in ms. Throws on failure. */
export function runScript(app: App, script: string, env: NodeJS.ProcessEnv = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const child = spawn("pnpm", ["run", "--silent", script], {
      cwd: app.dir,
      env: { ...process.env, ...app.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(performance.now() - started);
      else
        reject(
          new Error(
            `${app.id}: \`pnpm run ${script}\` exited with ${code}\n${output.slice(-4000)}`,
          ),
        );
    });
  });
}

export interface Server {
  app: App;
  /** Spawn → first 200 on `/`, in ms. */
  startMs: number;
  stop(): Promise<void>;
  /** Resident memory of the process listening on the app's port (and its children), in MB. */
  rssMb(): number;
  output(): string;
}

async function isListening(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

/** Spawns `dev` or `start` and waits for the first 200 on `/`. */
export async function startServer(
  app: App,
  script: "dev" | "start",
  env: NodeJS.ProcessEnv = {},
  timeoutMs = 180_000,
): Promise<Server> {
  if (await isListening(app.port)) {
    throw new Error(`${app.id}: port ${app.port} is already in use; stop that server first`);
  }
  const started = performance.now();
  const child: ChildProcess = spawn("pnpm", ["run", "--silent", script], {
    cwd: app.dir,
    env: {
      ...process.env,
      ...app.env,
      // Production servers run as production (verified with listenerEnv); dev servers set their own.
      ...(script === "start" ? { NODE_ENV: "production" } : {}),
      PORT: String(app.port),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group, so stop() also ends the framework's child processes
  });
  let output = "";
  child.stdout!.on("data", (chunk: Buffer) => (output += chunk));
  child.stderr!.on("data", (chunk: Buffer) => (output += chunk));
  let exited = false;
  const exit = new Promise<void>((resolve) => child.on("exit", () => ((exited = true), resolve())));

  const stop = async () => {
    if (!exited) {
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {}
      const killer = setTimeout(() => {
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {}
      }, 5000);
      await exit;
      clearTimeout(killer);
    }
    for (let i = 0; i < 100 && (await isListening(app.port)); i++) await sleep(100);
  };

  let startMs = -1;
  while (performance.now() - started < timeoutMs) {
    if (exited)
      throw new Error(`${app.id}: \`${script}\` exited before serving\n${output.slice(-4000)}`);
    try {
      const response = await fetch(`${baseUrl(app)}/`, { signal: AbortSignal.timeout(60_000) });
      await response.arrayBuffer();
      if (response.status === 200) {
        startMs = performance.now() - started;
        break;
      }
    } catch {}
    await sleep(25);
  }
  if (startMs < 0) {
    await stop();
    throw new Error(
      `${app.id}: \`${script}\` did not serve / within ${timeoutMs} ms\n${output.slice(-4000)}`,
    );
  }
  return { app, startMs, stop, rssMb: () => listenerRssMb(app.port), output: () => output };
}

function listenerPid(port: number): number {
  return Number(
    execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).split("\n")[0],
  );
}

/**
 * An environment variable of the process listening on `port` (macOS/BSD `ps -E`), or null. A
 * process that rewrites its title (`next-server`) also hides its environment from `ps`; then the
 * nearest ancestor that shows one answers, since children inherit it.
 */
export function listenerEnv(port: number, name: string): string | null {
  let pid = listenerPid(port);
  for (let depth = 0; depth < 4 && pid > 1; depth++) {
    const command = execFileSync("ps", ["-p", String(pid), "-wwE", "-o", "command="], {
      encoding: "utf8",
    });
    if (/\s[A-Za-z_][A-Za-z0-9_]*=/.test(command)) {
      return new RegExp(`(?:^|\\s)${name}=(\\S*)`).exec(command)?.[1] ?? null;
    }
    pid = Number(
      execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" }).trim(),
    );
  }
  return null;
}

/** The command a package script runs (`pnpm run <name>`). */
export function scriptOf(app: App, name: string): string {
  const pkg = JSON.parse(readFileSync(join(app.dir, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts?.[name] ?? "";
}

function listenerRssMb(port: number): number {
  const pid = listenerPid(port);
  const table = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number) as [number, number, number]);
  const tree = new Set([pid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [child, parent] of table) {
      if (tree.has(parent) && !tree.has(child)) {
        tree.add(child);
        grew = true;
      }
    }
  }
  const kb = table.filter(([p]) => tree.has(p)).reduce((sum, [, , rss]) => sum + rss, 0);
  return kb / 1024;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Version of a package as the app resolves it, or null. */
export function resolvedVersion(app: App, pkg: string, via?: string): string | null {
  try {
    let dir = app.dir;
    // A dependency of a dependency (`vite` via `lumiose`): resolve from that package's directory;
    // `a>b` follows a chain (`nitropack` via `nuxt>@nuxt/nitro-server`).
    for (const step of via?.split(">") ?? []) dir = dirname(packageJson(dir, step));
    return (JSON.parse(readFileSync(packageJson(dir, pkg), "utf8")) as { version: string }).version;
  } catch {
    return null;
  }
}

/**
 * The package.json of `pkg` as seen from `dir`, by Node's node_modules lookup rather than
 * `require.resolve`, which fails for packages whose `exports` hide it (`@solidjs/start`).
 */
function packageJson(dir: string, pkg: string): string {
  for (let current = dir; ; current = dirname(current)) {
    const candidate = join(current, "node_modules", pkg, "package.json");
    if (existsSync(candidate)) return realpathSync(candidate);
    if (dirname(current) === current) throw new Error(`${pkg} not found from ${dir}`);
  }
}

/** First project slug and first issue id of that project, read from the running app's HTML. */
export async function sampleRoutes(
  app: App,
): Promise<{ home: string; project: string; issue: string }> {
  // Quotes are optional in HTML attributes; the first project link is the sidebar's first entry.
  const home = await (await fetch(`${baseUrl(app)}/`)).text();
  const slug = /href=["']?\/projects\/([a-z0-9-]+)/.exec(home)?.[1];
  const project = `/projects/${slug}`;
  const list = await (await fetch(`${baseUrl(app)}${project}`)).text();
  const id = /data-issue-id=["']?(\d+)/.exec(list)?.[1];
  if (slug === undefined || id === undefined) {
    throw new Error(`${app.id}: cannot find the sample project/issue in the HTML`);
  }
  return { home: "/", project, issue: `/issues/${id}` };
}
