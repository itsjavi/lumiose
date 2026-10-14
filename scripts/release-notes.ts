// `node scripts/release-notes.ts <x.y.z>`: prints the GitHub release notes of a version, its
// CHANGELOG.md section (written by `pnpm release:version`), for release.yml's github-release job
// (TASK-277). Fails when CHANGELOG.md has no section for the version.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");

/**
 * The body of `version`'s section in `changelog` (from its `## x.y.z (date)` heading to the next
 * `## ` heading, the heading itself left out, since the release is titled by its tag), followed by
 * an install line; `undefined` when there is no such section.
 */
export function releaseNotes(changelog: string, version: string): string | undefined {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## ${version} (`));
  if (start === -1) return undefined;
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const body = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join("\n")
    .trim();
  const install = `Every package is published to npm at ${version}. Start a project with \`npm create lumiose@latest\`.`;
  return `${body === "" ? "No notable changes." : body}\n\n${install}\n`;
}

if (import.meta.main) {
  const version = process.argv[2]?.replace(/^v/, "");
  if (!version) {
    console.error("Usage: node scripts/release-notes.ts <x.y.z>");
    process.exit(2);
  }
  const notes = releaseNotes(readFileSync(join(REPO, "CHANGELOG.md"), "utf8"), version);
  if (notes === undefined) {
    console.error(`CHANGELOG.md has no "## ${version} (…)" section.`);
    process.exit(1);
  }
  process.stdout.write(notes);
}
