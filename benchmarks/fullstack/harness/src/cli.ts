// Shared command-line options of the harness scripts.
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { APPS, type App, appExists } from "./apps.ts";

export function selectApps(only: string | undefined): App[] {
  const ids = only?.split(",").map((id) => id.trim());
  const unknown = ids?.filter((id) => !APPS.some((app) => app.id === id)) ?? [];
  if (unknown.length > 0)
    throw new Error(
      `unknown app(s): ${unknown.join(", ")} (known: ${APPS.map((a) => a.id).join(", ")})`,
    );
  return APPS.filter((app) => (ids === undefined || ids.includes(app.id)) && appExists(app));
}

export function args<const T extends ParseArgsOptionsConfig>(options: T) {
  // `pnpm --filter … bench -- --quick` passes a literal `--` through.
  return parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options,
    strict: true,
  }).values;
}
