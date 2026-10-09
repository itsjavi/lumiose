// The results file format of doc-4 §6: metric definitions, per-app samples summarised as median,
// min and max, run metadata, and results/index.json listing the runs newest first.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, hostname, release, totalmem, type } from "node:os";
import { join } from "node:path";
import { FULLSTACK } from "./apps.ts";

export const RESULTS_DIR = join(FULLSTACK, "results");

export type Group = "dev" | "build" | "load" | "server" | "other";
export const GROUPS: Group[] = ["dev", "build", "load", "server", "other"];
/**
 * Where a metric is measured: `dev` against the dev servers (Vite, Turbopack), `build` from the
 * production build and the sources (build time, output size, type check, source size), `prod`
 * against the built apps on their production servers (payload, page load, throughput).
 */
export type Env = "dev" | "build" | "prod";
export const ENVS: Env[] = ["dev", "build", "prod"];

export type Unit = "ms" | "bytes" | "MB" | "req/s" | "count" | "lines";

export interface MetricDef {
  label: string;
  group: Group;
  env: Env;
  better: "lower" | "higher";
  unit: Unit;
  /** Optional sub-heading inside the group, e.g. the route. */
  section?: string;
}

export interface Summary {
  unit: Unit;
  values: number[];
  median: number;
  min: number;
  max: number;
}

/** How an app is served in each mode (schema 2). */
export interface ServerInfo {
  dev: { command: string; tool: string; description: string };
  build: { command: string };
  prod: {
    command: string;
    description: string;
    /** NODE_ENV of the process listening on the app's port, checked during the run. */
    nodeEnv: string | null;
    /** Whether `/` came back compressed for a client accepting br and gzip. */
    compression: boolean | null;
  };
}

/**
 * Schema 2 adds `env` to every metric and `meta.servers`. Schema 1 files have neither; readers
 * derive `env` with {@link envOf}.
 */
export interface RunFile {
  schema: 2;
  meta: {
    date: string;
    host: string;
    machine: { cpu: string; cores: number; memoryGb: number; os: string };
    node: string;
    versions: Record<string, string | null>;
    iterations: Record<"dev" | "build" | "load" | "server", number>;
    quick: boolean;
    groups: Group[];
    apps: string[];
    conformance: Record<string, "pass" | "fail" | "skipped">;
    notes: string[];
    servers: Record<string, ServerInfo>;
  };
  results: Record<string, Record<string, Summary>>;
  metrics: Record<string, MetricDef>;
}

/** The env of a metric from its id and group (also how the viewer reads schema-1 files). */
export function envOf(id: string, group: Group): Env {
  if (group === "dev") return "dev";
  if (group === "load" || group === "server" || id.startsWith("payload.")) return "prod";
  return "build";
}

export function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export class Recorder {
  readonly metrics: Record<string, MetricDef> = {};
  private readonly samples: Record<string, Record<string, number[]>> = {};

  add(app: string, id: string, def: Omit<MetricDef, "env"> & { env?: Env }, value: number): void {
    this.metrics[id] ??= { ...def, env: def.env ?? envOf(id, def.group) };
    ((this.samples[app] ??= {})[id] ??= []).push(value);
  }

  summaries(): RunFile["results"] {
    const results: RunFile["results"] = {};
    for (const [app, metrics] of Object.entries(this.samples)) {
      results[app] = {};
      for (const [id, values] of Object.entries(metrics)) {
        results[app][id] = {
          unit: this.metrics[id]!.unit,
          values: values.map(round),
          median: round(median(values)),
          min: round(Math.min(...values)),
          max: round(Math.max(...values)),
        };
      }
    }
    return results;
  }
}

export function machine(): RunFile["meta"]["machine"] {
  let os = `${type()} ${release()}`;
  try {
    if (type() === "Darwin")
      os = `macOS ${execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim()}`;
  } catch {}
  return {
    cpu: cpus()[0]?.model ?? "unknown",
    cores: cpus().length,
    memoryGb: Math.round(totalmem() / 2 ** 30),
    os,
  };
}

export const shortHost = (): string =>
  hostname()
    .replace(/\.local$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

/**
 * Writes `results/<YYYY-MM-DD>T<HHMMSS>-<host>.json` (UTC start of the run) and refreshes
 * index.json. Every run gets its own file, so a later run (a `--quick` or `--only` one included)
 * never replaces an earlier one.
 */
export function writeRun(run: RunFile): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = `${run.meta.date.slice(0, 10)}T${run.meta.date.slice(11, 19).replaceAll(":", "")}`;
  let name = `${stamp}-${run.meta.host}.json`;
  for (let n = 2; existsSync(join(RESULTS_DIR, name)); n++)
    name = `${stamp}-${run.meta.host}-${n}.json`;
  writeFileSync(join(RESULTS_DIR, name), `${JSON.stringify(run, null, 2)}\n`);
  writeIndex();
  return join(RESULTS_DIR, name);
}

export function writeIndex(): void {
  const runs = readdirSync(RESULTS_DIR)
    .filter((file) => file.endsWith(".json") && file !== "index.json")
    .map((file) => {
      const { meta } = JSON.parse(readFileSync(join(RESULTS_DIR, file), "utf8")) as RunFile;
      return {
        file,
        date: meta.date,
        host: meta.host,
        machine: meta.machine,
        quick: meta.quick,
        apps: meta.apps,
        groups: meta.groups,
      };
    })
    .toSorted((a, b) => b.date.localeCompare(a.date));
  writeFileSync(join(RESULTS_DIR, "index.json"), `${JSON.stringify({ runs }, null, 2)}\n`);
}
