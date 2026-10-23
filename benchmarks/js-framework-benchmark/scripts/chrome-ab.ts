// Shared parts of the in-process Chrome A/Bs (grid-ab.ts, measure-ab.ts): the runtime sources of
// a git ref, a page bundle built against them, a minimal Chrome DevTools Protocol client over
// --remote-debugging-pipe, and the statistics they print.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import lumiose from "@lumiose/vite";
import { build } from "vite";

export const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(PKG, "../..");
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** The runtime sources (packages/lumiose/src) of `ref`, exported into `work`; `.` is this tree. */
export function runtime(ref: string, name: string, work: string): string {
  if (ref === ".") return join(REPO, "packages/lumiose/src");
  const dir = join(work, `src-${name}`);
  mkdirSync(dir);
  const tar = join(work, `${name}.tar`);
  const archive = spawnSync("git", ["archive", "-o", tar, ref, "packages/lumiose/src"], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (archive.status !== 0) throw new Error(`git archive ${ref}: ${archive.stderr}`);
  const untar = spawnSync("tar", ["-xf", tar, "-C", dir], { encoding: "utf8" });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  return join(dir, "packages/lumiose/src");
}

/** Builds `entry` against the runtime in `src`, as one classic script `<outDir>/<name>.js`. */
export async function bundle(entry: string, src: string, name: string, outDir: string) {
  await build({
    configFile: false,
    root: PKG,
    logLevel: "warn",
    mode: "production",
    plugins: [lumiose()],
    resolve: {
      alias: [
        { find: /^lumiose$/, replacement: join(src, "index.ts") },
        { find: /^lumiose\/dom$/, replacement: join(src, "dom/index.ts") },
      ],
    },
    build: {
      outDir,
      emptyOutDir: false,
      target: "esnext",
      lib: {
        entry: join(PKG, entry),
        formats: ["iife"],
        name: `ab_${name}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}

interface Message {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
  sessionId?: string;
}

function launchChrome(profile: string) {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--window-size=1280,900",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );
  const input = chrome.stdio[3] as Writable;
  const output = chrome.stdio[4] as Readable;
  const pending = new Map<number, (message: Message) => void>();
  const listeners: ((message: Message) => void)[] = [];
  let buffer = "";
  let seq = 0;
  output.setEncoding("utf8");
  output.on("data", (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\0")) !== -1) {
      const message = JSON.parse(buffer.slice(0, end)) as Message;
      buffer = buffer.slice(end + 1);
      if (message.id !== undefined) pending.get(message.id)?.(message);
      else for (const listener of listeners) listener(message);
    }
  });
  const send = (
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (message) => {
        pending.delete(id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result ?? {});
      });
      input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    });
  const once = (method: string): Promise<Message> =>
    new Promise((resolve) => {
      const listener = (message: Message) => {
        if (message.method !== method) return;
        listeners.splice(listeners.indexOf(listener), 1);
        resolve(message);
      };
      listeners.push(listener);
    });
  return { send, once, close: () => chrome.kill() };
}

export interface Page {
  /** Sends a CDP command to the page's session. */
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  /** Calls the in-page function source `fn` with JSON arguments and returns its (awaited) result. */
  evaluate<T>(fn: string, ...args: unknown[]): Promise<T>;
  close(): void;
}

/** Opens `file` in a headless Chrome with its profile in `profile`, at `cpu`x CPU slowdown. */
export async function openPage(file: string, profile: string, cpu: number): Promise<Page> {
  const chrome = launchChrome(profile);
  try {
    const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = (await chrome.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };
    const send = (method: string, params?: Record<string, unknown>) =>
      chrome.send(method, params, sessionId);
    await send("Page.enable");
    const loaded = chrome.once("Page.loadEventFired");
    await send("Page.navigate", { url: pathToFileURL(file).href });
    await loaded;
    await send("Emulation.setCPUThrottlingRate", { rate: cpu });
    const evaluate = async <T>(fn: string, ...args: unknown[]): Promise<T> => {
      const { result, exceptionDetails } = (await send("Runtime.evaluate", {
        expression: `(${fn})(${args.map((arg) => JSON.stringify(arg)).join(", ")})`,
        awaitPromise: true,
        returnByValue: true,
      })) as { result: { value: T }; exceptionDetails?: { text: string } };
      if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
      return result.value;
    };
    return { send, evaluate, close: chrome.close };
  } catch (error) {
    chrome.close();
    throw error;
  }
}

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (position - lo);
}

export function stats(values: number[]): { median: number; p25: number; p75: number } {
  const sorted = values.toSorted((x, y) => x - y);
  return {
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}

const fmt = (value: number) => value.toFixed(2);

/** Prints a metric's medians and quartiles for `a` and `b`, and the median of their paired differences. */
export function printPaired(label: string, a: number[], b: number[]): void {
  const [sa, sb] = [stats(a), stats(b)];
  const diffs = stats(b.map((value, i) => value - a[i]!));
  console.log(`  ${label}`);
  console.log(`    a ${fmt(sa.median)} (p25 ${fmt(sa.p25)}, p75 ${fmt(sa.p75)})`);
  console.log(`    b ${fmt(sb.median)} (p25 ${fmt(sb.p25)}, p75 ${fmt(sb.p75)})`);
  console.log(
    `    b - a, paired: median ${fmt(diffs.median)} (p25 ${fmt(diffs.p25)}, p75 ${fmt(diffs.p75)}); b / a ${(sb.median / sa.median).toFixed(3)}`,
  );
}
