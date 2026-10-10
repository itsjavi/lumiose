// `pnpm release:version <x.y.z>`: moves every Lumiose package to one new version (lockstep). It
// sets the version of each published package (the @lumiose/compiler-<platform> packages included)
// and of the Cargo workspace, pins internal dependencies that are not `workspace:` to it (pnpm pins
// `workspace:*` itself when packing), prepends the release's section to CHANGELOG.md from the
// Conventional Commits since the last `v*` tag, then commits `chore(release): vX.Y.Z` and creates
// the tag vX.Y.Z. It pushes nothing: pushing the tag starts the release workflow.
// `--dry-run` prints the changes and writes nothing.
//
//   node scripts/release.ts <x.y.z> [--dry-run] [--since <rev>]

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { publishable, readManifest } from "./pack.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** -1, 0 or 1 as semver `a` is lower than, equal to or higher than `b`. */
export function compareVersions(a: string, b: string): number {
  const pa = VERSION.exec(a);
  const pb = VERSION.exec(b);
  if (pa === null || pb === null) throw new Error(`not a version: ${pa === null ? a : b}`);
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return Math.sign(diff);
  }
  if (pa[4] === pb[4]) return 0;
  if (pa[4] === undefined) return 1;
  if (pb[4] === undefined) return -1;
  return pa[4] < pb[4] ? -1 : 1;
}

export interface Commit {
  hash: string;
  type: string;
  scope?: string;
  subject: string;
  breaking: boolean;
}

/** A Conventional Commit (`type(scope)!: subject`), or undefined for any other message. */
export function parseCommit(hash: string, message: string): Commit | undefined {
  const [header = "", ...body] = message.split("\n");
  const match = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/.exec(header.trim());
  if (match === null) return undefined;
  const breaking = match[3] === "!" || body.some((line) => /^BREAKING[ -]CHANGE:/.test(line));
  return { hash, type: match[1]!, scope: match[2], subject: match[4]!, breaking };
}

const SECTIONS: [string, (commit: Commit) => boolean][] = [
  ["Breaking changes", (c) => c.breaking],
  ["Features", (c) => !c.breaking && c.type === "feat"],
  ["Fixes", (c) => !c.breaking && c.type === "fix"],
  ["Performance", (c) => !c.breaking && c.type === "perf"],
];

/** The CHANGELOG.md section of a release: breaking changes, features, fixes and performance. */
export function renderChangelog(version: string, date: string, commits: Commit[]): string {
  const lines = [`## ${version} (${date})`, ""];
  let listed = 0;
  for (const [title, belongs] of SECTIONS) {
    const entries = commits.filter(belongs);
    if (entries.length === 0) continue;
    lines.push(`### ${title}`, "");
    for (const c of entries) {
      lines.push(`- ${c.scope === undefined ? "" : `**${c.scope}:** `}${c.subject} (${c.hash})`);
    }
    lines.push("");
    listed += entries.length;
  }
  if (listed === 0) lines.push("No user-facing changes.", "");
  return lines.join("\n");
}

const HEADER = "# Changelog\n\nAll Lumiose packages share one version.\n\n";

/** CHANGELOG.md with `section` added above the previous releases. */
export function prependChangelog(current: string | undefined, section: string): string {
  const previous = current?.startsWith(HEADER) ? current.slice(HEADER.length) : (current ?? "");
  return `${HEADER}${section}${previous.length > 0 ? `\n${previous}` : ""}`;
}

/** `text` (a package.json) with its top-level version set, keeping the file's formatting. */
export function setPackageVersion(text: string, version: string): string {
  const next = text.replace(/^( {2}"version": )"[^"]*"/m, `$1"${version}"`);
  if (next === text && !text.includes(`"version": "${version}"`)) {
    throw new Error("package.json has no top-level version");
  }
  return next;
}

/** `text` (a package.json) with internal dependencies that are not `workspace:` pinned to `version`. */
export function pinInternalDependencies(text: string, names: Set<string>, version: string): string {
  const manifest = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
  let next = text;
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (!names.has(name) || spec.startsWith("workspace:") || spec === version) continue;
      const entry = new RegExp(`("${escapeRegExp(name)}": )"${escapeRegExp(spec)}"`);
      next = next.replace(entry, `$1"${version}"`);
    }
  }
  return next;
}

/** Cargo.toml with `[workspace.package] version` set. */
export function setCargoVersion(text: string, version: string): string {
  const next = text.replace(/(\[workspace\.package\][^[]*?\nversion = )"[^"]*"/, `$1"${version}"`);
  if (next === text && !text.includes(`version = "${version}"`)) {
    throw new Error("Cargo.toml has no [workspace.package] version");
  }
  return next;
}

/** Cargo.lock with the version of the workspace crates `names` (no `source`) set. */
export function setCargoLockVersions(text: string, names: Set<string>, version: string): string {
  return text
    .split("\n[[package]]\n")
    .map((block) => {
      const name = /^name = "([^"]+)"$/m.exec(block)?.[1];
      if (name === undefined || !names.has(name) || /^source = /m.test(block)) return block;
      return block.replace(/^version = "[^"]*"$/m, `version = "${version}"`);
    })
    .join("\n[[package]]\n");
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
}

/** The Conventional Commits after `since` (default: the last `v*` tag; none: every commit). */
export function commitsSince(repo: string, since?: string): Commit[] {
  let from = since;
  if (from === undefined) {
    try {
      from = git(repo, ["describe", "--tags", "--abbrev=0", "--match", "v*"]);
    } catch {
      from = undefined;
    }
  }
  const range = from === undefined ? "HEAD" : `${from}..HEAD`;
  const log = git(repo, ["log", "--no-merges", "--format=%h%x1f%B%x1e", range]);
  return log
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = "", message = ""] = entry.split("\x1f");
      return parseCommit(hash, message.trim());
    })
    .filter((commit): commit is Commit => commit !== undefined);
}

/** The Cargo workspace's crates (crates/<name>/Cargo.toml). */
function cargoCrates(repo: string): Set<string> {
  const dir = join(repo, "crates");
  if (!existsSync(dir)) return new Set();
  const names = readdirSync(dir)
    .map((name) => join(dir, name, "Cargo.toml"))
    .filter(existsSync)
    .map((file) => /^name = "([^"]+)"$/m.exec(readFileSync(file, "utf8"))?.[1])
    .filter((name): name is string => name !== undefined);
  return new Set(names);
}

export interface ReleaseOptions {
  dryRun?: boolean;
  /** The revision the changelog starts after (default: the last `v*` tag). */
  since?: string;
  /** The release date for the changelog (default: today, UTC). */
  date?: string;
  log?: (line: string) => void;
}

/** Plans the release of `version` in `repo`: the files to write (path → content) and the changelog section. */
export function planRelease(
  repo: string,
  version: string,
  options: ReleaseOptions = {},
): { current: string; files: Map<string, string>; changelog: string } {
  if (!VERSION.test(version)) throw new Error(`not a version: ${version} (expected x.y.z)`);
  const dirs = publishable(repo);
  const manifests = dirs.map((dir) => readManifest(dir));
  const versions = new Set(manifests.map((m) => m.version));
  if (versions.size !== 1) {
    throw new Error(`the packages do not share one version: ${[...versions].join(", ")}`);
  }
  const current = [...versions][0]!;
  if (compareVersions(version, current) <= 0) {
    throw new Error(`${version} is not above the current version ${current}`);
  }
  const names = new Set(manifests.map((m) => m.name));
  const files = new Map<string, string>();
  for (const dir of dirs) {
    const path = join(dir, "package.json");
    const text = readFileSync(path, "utf8");
    files.set(path, pinInternalDependencies(setPackageVersion(text, version), names, version));
  }
  const cargo = join(repo, "Cargo.toml");
  if (existsSync(cargo)) files.set(cargo, setCargoVersion(readFileSync(cargo, "utf8"), version));
  const lock = join(repo, "Cargo.lock");
  if (existsSync(lock)) {
    files.set(lock, setCargoLockVersions(readFileSync(lock, "utf8"), cargoCrates(repo), version));
  }
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const changelog = renderChangelog(version, date, commitsSince(repo, options.since));
  const changelogPath = join(repo, "CHANGELOG.md");
  const previous = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : undefined;
  files.set(changelogPath, prependChangelog(previous, changelog));
  return { current, files, changelog };
}

/**
 * Releases `version`: writes the planned files, commits them and tags the commit, on a clean
 * working tree. With `dryRun`, only reports the plan.
 */
export function release(repo: string, version: string, options: ReleaseOptions = {}): void {
  const log = options.log ?? console.log;
  const tag = `v${version}`;
  if (!options.dryRun) {
    const status = git(repo, ["status", "--porcelain"]);
    if (status !== "")
      throw new Error(`the working tree has changes; commit or stash them first:\n${status}`);
  }
  if (git(repo, ["tag", "--list", tag]) !== "") throw new Error(`the tag ${tag} already exists`);
  const plan = planRelease(repo, version, options);
  const paths = [...plan.files.keys()].map((path) => relative(repo, path).split(sep).join("/"));
  log(`${options.dryRun ? "dry run: " : ""}${plan.current} -> ${version}`);
  for (const path of paths) log(`  ${path}`);
  log("");
  log(plan.changelog);
  if (options.dryRun) return;
  for (const [path, content] of plan.files) writeFileSync(path, content);
  git(repo, ["add", "--", ...paths]);
  git(repo, ["commit", "-q", "-m", `chore(release): ${tag}`, "--", ...paths]);
  git(repo, ["tag", "-a", tag, "-m", tag]);
  log(`Committed and tagged ${tag}. Push both to release: git push origin HEAD ${tag}`);
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      since: { type: "string" },
    },
  });
  if (positionals.length !== 1) {
    console.error("Usage: pnpm release:version <x.y.z> [--dry-run] [--since <rev>]");
    process.exit(2);
  }
  try {
    release(REPO, positionals[0]!, { dryRun: values["dry-run"], since: values.since });
  } catch (error) {
    console.error(`release:version: ${(error as Error).message}`);
    process.exit(1);
  }
}
