// `lumiose routes` (the route table) and `lumiose typegen` (route types and shadow TSX), spec §4.7, §8.
// Both use the project's default mode from `lumiose({ mode })` (decision-21).

import { relative, sep } from "node:path";
import type { RouteManifest, RouteParam } from "../app/routes/manifest.ts";
import { scanRoutes } from "../app/routes/scan.ts";
import { typegen } from "../app/typegen/index.ts";
import {
  fromAppDiagnostic,
  summarize,
  type CheckDiagnostic,
  type CheckSummary,
} from "./check/diagnostics.ts";
import { formatHuman } from "./check/report.ts";
import { SHADOW_DIR, syncShadows } from "./check/shadow.ts";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_PROBLEMS,
  failureOf,
  formatEnvelope,
  type OutputFormat,
} from "./output.ts";
import { projectRoot, routeOptions } from "./project.ts";

export interface RouteInfo {
  /** `/blog/[slug]`. */
  pattern: string;
  /** Project-relative POSIX path. */
  file: string;
  kind: "page" | "endpoint";
  mode: "static" | "server" | "spa";
  /** Pages only: `false` for a `spa` page rendered as a client shell. */
  ssr?: boolean;
  /** Layout files (project-relative), outermost first; empty for endpoints. */
  layouts: string[];
  params: RouteParam[];
}

export interface RoutesReport {
  /** Project-relative routes directory. */
  routesDir: string;
  /** The project default, `lumiose({ mode })`; layouts and routes override it. */
  defaultMode: "static" | "server" | "spa";
  /** In match priority order. */
  routes: RouteInfo[];
  diagnostics: CheckDiagnostic[];
  summary: CheckSummary;
}

/** The project's routes with their modes and layouts. */
export async function listRoutes(root: string): Promise<RoutesReport> {
  const options = await routeOptions(root, "routes");
  return routesReport(await scanRoutes(root, options), options.defaultMode ?? "static");
}

function routesReport(
  manifest: RouteManifest,
  defaultMode: RoutesReport["defaultMode"],
): RoutesReport {
  const routes = manifest.routes.map((route): RouteInfo =>
    route.kind === "page"
      ? {
          pattern: route.pattern,
          file: route.file,
          kind: "page",
          mode: route.mode,
          ssr: route.ssr,
          layouts: route.layouts,
          params: route.params,
        }
      : {
          pattern: route.pattern,
          file: route.file,
          kind: "endpoint",
          mode: route.mode,
          layouts: [],
          params: route.params,
        },
  );
  const diagnostics = manifest.diagnostics.map(fromAppDiagnostic);
  return {
    routesDir: manifest.routesDir,
    defaultMode,
    routes,
    diagnostics,
    summary: summarize(diagnostics),
  };
}

export interface CommandIO {
  format: OutputFormat;
  color?: boolean;
  write: (text: string) => void;
  writeError: (text: string) => void;
}

/** `lumiose routes`: prints the route table (or JSON); exit 1 when the routes have errors. */
export async function routesCommand(options: { root: string } & CommandIO): Promise<number> {
  let report: RoutesReport;
  try {
    report = await listRoutes(projectRoot(options.root));
  } catch (error) {
    return fail("routes", error, options);
  }
  const ok = report.summary.errors === 0;
  if (options.format === "json") {
    options.write(formatEnvelope("routes", ok, report));
  } else {
    options.write(routesTable(report));
    if (report.diagnostics.length > 0) {
      options.write(`\n${formatHuman(report, { color: options.color ?? false })}`);
    }
  }
  return ok ? EXIT_OK : EXIT_PROBLEMS;
}

/** The human route table: paths relative to the routes directory. */
export function routesTable(report: RoutesReport): string {
  if (report.routes.length === 0) {
    return `No routes in ${report.routesDir}. Add a page, such as ${report.routesDir}/index.stsx.\n`;
  }
  const prefix = `${report.routesDir}/`;
  const short = (file: string) => (file.startsWith(prefix) ? file.slice(prefix.length) : file);
  const rows = report.routes.map((route) => [
    route.pattern,
    route.kind,
    route.ssr === false ? `${route.mode} (shell)` : route.mode,
    short(route.file),
    route.layouts.map(short).join(", "),
  ]);
  const header = ["PATTERN", "KIND", "MODE", "FILE", "LAYOUTS"];
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column]!.length)),
  );
  const line = (cells: string[]) =>
    `${cells
      .map((cell, column) => cell.padEnd(widths[column]!))
      .join("  ")
      .trimEnd()}\n`;
  const pages = report.routes.filter((route) => route.kind === "page").length;
  return [
    `Routes in ${report.routesDir} (default mode: ${report.defaultMode}): ${plural(pages, "page")}, ${plural(report.routes.length - pages, "endpoint")}\n\n`,
    line(header),
    ...rows.map(line),
  ].join("");
}

/** `lumiose typegen`: writes `.lumiose/types/routes.d.ts` and syncs the shadow TSX files. */
export async function typegenCommand(options: { root: string } & CommandIO): Promise<number> {
  let root: string;
  let result;
  let shadows;
  try {
    root = projectRoot(options.root);
    result = await typegen(root, await routeOptions(root, "typegen"));
    shadows = await syncShadows(root);
  } catch (error) {
    return fail("typegen", error, options);
  }
  const key = (file: string) => relative(root, file).split(sep).join("/");
  const diagnostics = result.manifest.diagnostics.map(fromAppDiagnostic);
  const summary = summarize(diagnostics);
  const ok = summary.errors === 0;
  const routeTypes = { file: key(result.file), changed: result.changed };
  if (options.format === "json") {
    options.write(
      formatEnvelope("typegen", ok, {
        routeTypes,
        routes: result.manifest.routes.length,
        shadows: {
          dir: SHADOW_DIR,
          files: shadows.files.length,
          written: shadows.written.map(key),
          deleted: shadows.deleted.map(key),
        },
        diagnostics,
        summary,
      }),
    );
  } else {
    options.write(
      `${result.changed ? "Wrote" : "Up to date:"} ${routeTypes.file} (${plural(result.manifest.routes.length, "route")}).\n` +
        `Synced ${plural(shadows.files.length, "shadow file")} in ${SHADOW_DIR} (${shadows.written.length} written, ${shadows.deleted.length} deleted).\n`,
    );
    if (diagnostics.length > 0) {
      options.write(
        `\n${formatHuman({ diagnostics, summary }, { color: options.color ?? false })}`,
      );
    }
  }
  return ok ? EXIT_OK : EXIT_PROBLEMS;
}

function fail(command: string, error: unknown, io: CommandIO): number {
  const failure = failureOf(error);
  if (io.format === "json") io.write(formatEnvelope(command, false, { failure }));
  else
    io.writeError(
      `lumiose ${command} failed: ${failure.message}\n${failure.help ? `${failure.help}\n` : ""}`,
    );
  return EXIT_FAILURE;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
