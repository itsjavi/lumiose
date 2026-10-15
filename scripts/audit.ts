// `pnpm audit:packages` (decision-56, TASK-314): `pnpm audit --prod` for the packages Lumiose
// publishes. pnpm audits the whole workspace, where the examples, benchmarks and evals pin other
// frameworks' dependency trees; only advisories reached from a published package (a non-private
// package under packages/) count here. High and critical advisories fail; others are listed.
//
//   node scripts/audit.ts

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = join(import.meta.dirname, "..");
const FAILING = new Set(["high", "critical"]);

export interface Advisory {
  module_name: string;
  severity: string;
  title: string;
  url: string;
  findings: { version: string; paths: string[] }[];
}

/** The pnpm audit importer ids (`packages__vite`) of the packages Lumiose publishes. */
export function publishedImporters(root: string): Set<string> {
  const importers = new Set<string>();
  for (const dir of readdirSync(join(root, "packages"), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    let manifest: { private?: boolean };
    try {
      manifest = JSON.parse(readFileSync(join(root, "packages", dir.name, "package.json"), "utf8"));
    } catch {
      continue;
    }
    if (manifest.private !== true) importers.add(`packages__${dir.name}`);
  }
  return importers;
}

/** The advisories with at least one dependency path that starts at a published package. */
export function publishedAdvisories(advisories: Advisory[], importers: Set<string>): Advisory[] {
  return advisories.filter((advisory) =>
    advisory.findings.some((finding) =>
      finding.paths.some((path) => importers.has(path.split(">")[0]!)),
    ),
  );
}

function main(): number {
  let output: string;
  try {
    output = execFileSync("pnpm", ["audit", "--prod", "--json"], { cwd: repo, encoding: "utf8" });
  } catch (error) {
    // pnpm audit exits non-zero when it finds anything; the report is still on stdout.
    output = (error as { stdout?: string }).stdout ?? "";
    if (output === "") throw error;
  }
  const report = JSON.parse(output) as { advisories?: Record<string, Advisory> };
  const found = publishedAdvisories(
    Object.values(report.advisories ?? {}),
    publishedImporters(repo),
  );
  for (const advisory of found) {
    const versions = advisory.findings.map((finding) => finding.version).join(", ");
    console.log(
      `${advisory.severity}: ${advisory.module_name}@${versions}: ${advisory.title} (${advisory.url})`,
    );
  }
  const failing = found.filter((advisory) => FAILING.has(advisory.severity));
  console.log(
    found.length === 0
      ? "No advisories affect the published packages."
      : `${found.length} advisories affect the published packages, ${failing.length} high or critical.`,
  );
  return failing.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
