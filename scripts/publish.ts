// Publishes every Lumiose package to npm, in dependency order (the @lumiose/compiler-<platform>
// packages first), with provenance. Run by .github/workflows/release.yml on a `v*` tag, after the
// Binaries workflow's artifacts were downloaded into packages/compiler; it packs exactly what
// `pnpm pack:check` checks. A release needs every platform binary and a tag that names the
// packages' shared version. The packages outside lockstep (`INDEPENDENT_PACKAGES`, decision-54)
// are left out: each is published alone by its own `<name>@<x.y.z>` tag, which needs no binaries.
// `--dry-run` publishes nothing.
//
//   node scripts/publish.ts [--dry-run] [--out <dir>]

import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { INDEPENDENT_PACKAGES, packAll, publishTarballs } from "./pack.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));

/** The package outside lockstep a release tag publishes (`@lumiose/ui@0.2.0`), if it names one. */
export function taggedPackage(tag: string | undefined): string | undefined {
  const at = tag?.lastIndexOf("@") ?? -1;
  return at > 0 ? tag!.slice(0, at) : undefined;
}

/**
 * Why `tag` (a git ref name: `v0.1.0`, or `<name>@0.2.0` for a package outside lockstep) cannot
 * release `version` (of the lockstep packages, or of that package), or undefined.
 */
export function tagProblem(tag: string | undefined, version: string): string | undefined {
  const name = taggedPackage(tag);
  if (name !== undefined) {
    return tag === `${name}@${version}`
      ? undefined
      : `tag ${tag} does not match ${name}'s version ${version}`;
  }
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
  const tag = process.env.GITHUB_REF_NAME;
  const only = taggedPackage(tag);
  const { packed, failures } =
    only === undefined
      ? packAll(out, !dryRun, (name) => !INDEPENDENT_PACKAGES.has(name))
      : packAll(out, false, (name) => name === only);
  if (only !== undefined && !INDEPENDENT_PACKAGES.has(only)) {
    failures.push(`tag ${tag}: ${only} is released in lockstep, by a v<x.y.z> tag`);
  } else if (only !== undefined && packed.length === 0) {
    failures.push(`tag ${tag}: no published package is named ${only}`);
  }
  const version = packed[0]?.manifest.version ?? "";
  const problem = tagProblem(tag, version);
  if (problem !== undefined) failures.push(problem);
  if (failures.length === 0) failures.push(...publishTarballs(packed, { dryRun }));
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`${dryRun ? "dry run: " : ""}${packed.length} packages at ${version}`);
}
