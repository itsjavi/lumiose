// The three Tracker apps (doc-4 §3) and how to drive them: every app exposes the same package
// scripts (seed, dev, build, start, typecheck, clean) and listens on its fixed port.
import { type ChildProcess, spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FULLSTACK = fileURLToPath(new URL("../../", import.meta.url));
export const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

export type AppId = "lumen" | "react-router" | "next";

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
}

export const APPS: App[] = [
  {
    id: "lumen",
    name: "Lumen",
    dir: join(FULLSTACK, "apps/lumen"),
    port: 4101,
    clientOutput: ["dist/client"],
    serverOutput: ["dist/server"],
    hmr: {
      file: join(FULLSTACK, "apps/lumen/src/components/Layout.stsx"),
      find: "fullstack comparison benchmark",
    },
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
      env: { ...process.env, ...env },
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
    env: { ...process.env, PORT: String(app.port), ...env },
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

function listenerRssMb(port: number): number {
  const pid = Number(
    execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).split("\n")[0],
  );
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
export function resolvedVersion(app: App, pkg: string): string | null {
  try {
    const require = createRequire(join(app.dir, "package.json"));
    return (
      JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`), "utf8")) as {
        version: string;
      }
    ).version;
  } catch {
    return null;
  }
}

/** First project slug and first issue id of that project, read from the running app's HTML. */
export async function sampleRoutes(
  app: App,
): Promise<{ home: string; project: string; issue: string }> {
  const home = await (await fetch(`${baseUrl(app)}/`)).text();
  const slug =
    /data-testid="sidebar-project"[^>]*href="\/projects\/([^"?#]+)"|href="\/projects\/([^"?#]+)"[^>]*data-testid="sidebar-project"/.exec(
      home,
    );
  const project = `/projects/${slug?.[1] ?? slug?.[2]}`;
  const list = await (await fetch(`${baseUrl(app)}${project}`)).text();
  const id =
    /data-testid="issue-row"[^>]*data-issue-id="(\d+)"|data-issue-id="(\d+)"[^>]*data-testid="issue-row"/.exec(
      list,
    );
  if (slug === null || id === null)
    throw new Error(`${app.id}: cannot find the sample project/issue in the HTML`);
  return { home: "/", project, issue: `/issues/${id[1] ?? id[2]}` };
}
