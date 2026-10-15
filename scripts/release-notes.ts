// `node scripts/release-notes.ts <tag>`: prints the GitHub release notes of a release tag, its
// changelog section (written by `pnpm release:version`), for release.yml's github-release job
// (TASK-277). A lockstep tag (`v0.4.0`, or the bare version) reads CHANGELOG.md; the tag of a
// package outside lockstep (`@lumiose/ui@0.2.0`, TASK-333) reads that package's own CHANGELOG.md.
// Fails when the changelog has no section for the version.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");

/** The package and version a tag names: `@lumiose/ui@0.2.0`, or `v0.4.0` (no package). */
export function parseTag(tag: string): { name?: string; version: string } {
  const at = tag.lastIndexOf("@");
  if (at > 0) return { name: tag.slice(0, at), version: tag.slice(at + 1) };
  return { version: tag.replace(/^v/, "") };
}

/**
 * The body of `version`'s section in `changelog` (from its `## x.y.z (date)` heading to the next
 * `## ` heading, the heading itself left out, since the release is titled by its tag), followed by
 * an install line (for package `name` when it is released outside lockstep); `undefined` when
 * there is no such section.
 */
export function releaseNotes(
  changelog: string,
  version: string,
  name?: string,
): string | undefined {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${version} (`));
  if (start === -1) return undefined;
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const body = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .trim();
  const install =
    name === undefined
      ? `Every package is published to npm at ${version}. Start a project with \`npm create lumiose@latest\`.`
      : `Published to npm as \`${name}@${version}\`, with its own version outside the lockstep version of the other Lumiose packages.`;
  return `${body === "" ? "No notable changes." : body}\n\n${install}\n`;
}

/** The CHANGELOG.md of `name` (a package outside lockstep) or, without one, the repository's. */
function changelogPath(name: string | undefined): string {
  if (name === undefined) return join(REPO, "CHANGELOG.md");
  const packages = join(REPO, "packages");
  for (const dir of readdirSync(packages)) {
    const manifest = join(packages, dir, "package.json");
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === name) {
      return join(packages, dir, "CHANGELOG.md");
    }
  }
  throw new Error(`no package named ${name} in packages/`);
}

if (import.meta.main) {
  const tag = process.argv[2];
  if (!tag) {
    console.error("Usage: node scripts/release-notes.ts <tag>   (v0.4.0, or @lumiose/ui@0.2.0)");
    process.exit(2);
  }
  const { name, version } = parseTag(tag);
  const path = changelogPath(name);
  const notes = existsSync(path)
    ? releaseNotes(readFileSync(path, "utf8"), version, name)
    : undefined;
  if (notes === undefined) {
    console.error(`${path} has no "## ${version} (…)" section.`);
    process.exit(1);
  }
  process.stdout.write(notes);
}
