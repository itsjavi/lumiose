// Helpers for the hidden acceptance tests. The grader copies this file next to a task's hidden
// tests into the run's project (`eval-hidden/`), and runs them with the project's own Vitest and
// Lumen, from the project root.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const root = process.cwd();
const lumenBin = join(root, "node_modules/lumen/src/cli/bin.ts");

/** Runs the project's `lumen` CLI with `--format json` and returns the parsed report. */
export function lumen(args: string[]): { code: number | null; json: any; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [lumenBin, ...args, "--format", "json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 180_000,
  });
  let json: any = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {}
  return { code: result.status, json, stdout: result.stdout, stderr: result.stderr };
}

export interface Dev {
  url: string;
  get(path: string, init?: RequestInit): Promise<Response>;
  /** POSTs form fields as a same-origin form submission (redirects are not followed). */
  post(path: string, fields: Record<string, string | string[]>, init?: RequestInit): Promise<Response>;
  stop(): Promise<void>;
}

/** Starts `lumen dev` on a free port. */
export async function startDev(): Promise<Dev> {
  const child = spawn(process.execPath, [lumenBin, "dev", "--format", "json", "--port", "0"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const url = await new Promise<string>((resolve, reject) => {
    let stdout = "";
    const timer = setTimeout(() => reject(new Error(`lumen dev did not start\n${stderr}`)), 60_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      const line = stdout.split("\n").find((l) => l.includes('"url"'));
      if (line) {
        clearTimeout(timer);
        resolve((JSON.parse(line) as { url: string }).url);
      }
    });
    child.on("close", (code) => reject(new Error(`lumen dev exited with ${code}\n${stderr}`)));
  });
  const origin = new URL(url).origin;
  return {
    url,
    get: (path, init) => fetch(new URL(path, url), { redirect: "manual", ...init }),
    post: (path, fields, init) => {
      const body = new URLSearchParams();
      for (const [key, value] of Object.entries(fields)) {
        for (const v of Array.isArray(value) ? value : [value]) body.append(key, v);
      }
      return fetch(new URL(path, url), {
        method: "POST",
        body,
        redirect: "manual",
        ...init,
        headers: { origin, "content-type": "application/x-www-form-urlencoded", ...(init?.headers as Record<string, string> | undefined) },
      });
    },
    stop: () =>
      new Promise<void>((resolve) => {
        child.on("close", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000);
      }),
  };
}

/** Text content of an HTML document, tags removed and whitespace collapsed. */
export function text(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds the app (`lumen build`) and returns the CSS it emitted, concatenated. */
export function buildCss(): string {
  const build = lumen(["build"]);
  if (build.code !== 0) throw new Error(`lumen build failed\n${build.stderr}${build.stdout}`);
  let css = "";
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".css")) css += readFileSync(path, "utf8");
      else if (name.endsWith(".html")) {
        for (const match of readFileSync(path, "utf8").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css += match[1];
      }
    }
  };
  for (const dir of ["dist/client", "dist"]) if (existsSync(join(root, dir))) return walk(join(root, dir)), css;
  return css;
}

/** A project file's text ("" when missing). */
export function source(file: string): string {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export interface IslandRecord {
  id: number;
  /** `/src/components/X.stsx#Export`. */
  ref: string;
  strategy: string;
  props: Record<string, unknown>;
}

/** The island records of a server-rendered page. */
export function islands(html: string): IslandRecord[] {
  const records: IslandRecord[] = [];
  for (const match of html.matchAll(/<script type="application\/json" data-l-islands>([\s\S]*?)<\/script>/g)) {
    records.push(...(JSON.parse(match[1]!) as IslandRecord[]));
  }
  return records;
}

/** `lumen check` diagnostics codes for the project (or for one file). */
export function checkCodes(file?: string): string[] {
  const { json } = lumen(["check"]);
  const diagnostics = (json?.diagnostics ?? []) as { code: string; file: string }[];
  return diagnostics.filter((d) => file === undefined || d.file === file).map((d) => d.code);
}
