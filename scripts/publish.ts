// Publishes every Lumiose package to npm, in dependency order (the @lumiose/compiler-<platform>
// packages first), with provenance. Run by .github/workflows/release.yml on a `v*` tag, after the
// Binaries workflow's artifacts were downloaded into packages/compiler; it packs exactly what
// `pnpm pack:check` checks. A release needs every platform binary and a tag that names the
// packages' shared version. `--dry-run` publishes nothing.
//
//   node scripts/publish.ts [--dry-run] [--out <dir>]

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { packAll, publishTarballs } from "./pack.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));

/** Why `tag` (a git ref name such as `v0.1.0`) cannot release `version`, or undefined. */
export function tagProblem(tag: string | undefined, version: string): string | undefined {
  if (tag === undefined || !tag.startsWith("v")) return undefined;
  return tag === `v${version}` ? undefined : `tag ${tag} does not match the version ${version}`;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  const dryRun = values["dry-run"];
  const out = resolve(values.out ?? join(REPO, ".local/publish"));
  const { packed, failures } = packAll(out, !dryRun);
  const version = packed[0]?.manifest.version ?? "";
  const problem = tagProblem(process.env.GITHUB_REF_NAME, version);
  if (problem !== undefined) failures.push(problem);
  if (failures.length === 0) failures.push(...publishTarballs(packed, { dryRun }));
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`${dryRun ? "dry run: " : ""}${packed.length} packages at ${version}`);
}
