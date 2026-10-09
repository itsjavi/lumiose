// Agent setup files (spec §10, decision-10): `AGENTS.md` (a Lumen section between markers),
// `CLAUDE.md` referencing it, the `lumen` skill, the `.gitattributes` line for `.stsx` and, when
// missing, a `tsconfig.json` that extends the generated one (decision-25). Written by
// `lumen agents init` for existing projects and by create-lumen for new ones (`lumen/agents`).
// Re-running updates Lumen's parts and leaves everything else in these files alone.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { formatTsconfig } from "../check/tsconfig.ts";
import { EXIT_FAILURE, EXIT_OK, failureOf, formatEnvelope, type OutputFormat } from "../output.ts";
import { projectRoot } from "../project.ts";

export const AGENTS_START =
  "<!-- lumen:start (managed by `lumen agents init`; edit outside the markers) -->";
export const AGENTS_END = "<!-- lumen:end -->";
export const SKILL_FILE = ".claude/skills/lumen/SKILL.md";
export const GITATTRIBUTES_LINE = "*.stsx linguist-language=TSX";

/** The Lumen section of `AGENTS.md`, markers included. */
export function agentsSection(): string {
  return `${AGENTS_START}
## Lumen

This project uses Lumen: a TypeScript 7 web framework with \`.stsx\` components (TSX plus raw-CSS
\`<style>\` blocks), setup-once components with signals, file routes and server-first rendering
with islands. It is not React, Solid or Svelte: check the docs instead of guessing.

### Read the local docs first

- The docs for the installed version are in \`node_modules/lumen/docs\`. Start from the index,
  \`node_modules/lumen/docs/llms.txt\`, and read the page for the task before writing code.
- \`npx lumen docs <topic>\` prints or searches them (\`npx lumen docs signals\`,
  \`npx lumen docs "form action"\`); \`npx lumen explain <code>\` explains a diagnostic such as
  \`LUM2001\`.
- With MCP support, use the Lumen MCP server (\`npx lumen agents init --mcp\` registers it for
  Claude Code and Codex; elsewhere run \`npx lumen mcp\` over stdio): docs, \`check\` with fixes,
  routes, components, compiler output, rendered HTML and dev logs as tools.

### \`.stsx\` files

- \`.stsx\` is TSX plus raw-CSS \`<style>\` blocks. Read and edit everything outside \`<style>\` as
  TSX; the inside of a \`<style>\` block is plain CSS, not a string or CSS-in-JS.
- A block inside a component's JSX is scoped to that component's elements; \`<style global>\` is
  global. \`$name\` in CSS reads a module-level \`const\` (\`$theme.gap\` for object members).
- \`<style>\` belongs inside an intrinsic element, not in \`{…}\`, conditionals or \`.map\`
  (\`LUM3010\`). \`.tsx\` files cannot have \`<style>\` (\`LUM1006\`); \`.ts\` files hold non-UI code.
- Import with the extension: \`import { Card } from "./Card.stsx";\`.

### Key rules

- Components run once. Read a signal by calling it, \`count()\`, where the value is needed;
  \`const n = count()\` in the body is frozen (\`LUM2001\`). Derive with \`() => …\` or \`computed\`.
- No early returns on reactive state; put conditions in JSX (\`LUM2003\`). Write signals in
  handlers and effects, never in the component body (\`LUM2002\`).
- Use \`class\` and \`for\` (not \`className\`/\`htmlFor\`), \`onClick\`-style events,
  \`style={{ "font-weight": 600 }}\` and \`bind:value={signal}\`. Lists are plain \`.map\` with \`key\`.
- Routes are files in \`src/routes\` (\`_layout.stsx\`, \`[param].stsx\`, \`.ts\` endpoints exporting
  \`GET\`/\`POST\`). The project's default mode is \`lumen({ mode })\` in \`vite.config.ts\`; a route or
  layout overrides it with \`export const mode = "static" | "server" | "spa"\`. Request APIs
  (\`cookies()\`, \`request()\`) need \`server\` (\`LUM5001\`). Load data in async page components;
  mutate with form \`actions\`.
- Route types take the route pattern literal: \`PageProps<"/blog/[slug]">\`,
  \`LayoutProps<"/blog">\`, \`ActionContext<"/blog/[slug]">\`, \`Endpoint<"/api/posts">\`. Never cast
  action results: \`actionData<typeof actions>()\` and \`submit<typeof actions.save>(form)\` infer them.
- Only islands ship JS in \`static\`/\`server\` pages: \`<Counter client:load />\` or
  \`client:visible\`, with exported components and serializable props (\`LUM4001\`, \`LUM4002\`).
- Server-only code lives in \`*.server.ts\` modules or \`src/server/\`; never import it into islands
  (\`LUM4003\`). Secrets come from \`env("NAME")\`, not \`import.meta.env\`.
- Shared modules go in \`src/lib\` or \`src/components\`, not \`src/routes\` (\`LUM5002\`).

### Before you finish

Run \`npx lumen check\` (types, routes and Lumen diagnostics; \`--format json\` for a
\`{ command, ok, diagnostics }\` report) and fix every error, then \`npx lumen lint\` and
\`npx lumen fmt\`. \`npx lumen routes\` lists the routes with their modes. Every CLI command takes
\`--format json\` and exits 0 on success, 1 when it finds problems, 2 when it cannot run.
${AGENTS_END}
`;
}

/** The `lumen` skill bundle (Claude Code and other agents that read `.claude/skills`). */
export function skillFile(): string {
  return `---
name: lumen
description: Build, change and fix Lumen apps (.stsx components with TSX and raw-CSS <style> blocks, signals, file routes in src/routes, islands, form actions). Use for any edit to .stsx/.tsx components, routes, endpoints or lumen() options in vite.config.ts, and whenever lumen check reports LUMxxxx diagnostics.
---

# Lumen

Follow the Lumen section of \`AGENTS.md\`. This skill is the workflow.

## 1. Look it up

- Index: \`node_modules/lumen/docs/llms.txt\` (version-matched docs). Read the concept page for the
  task: components, signals, jsx, styles, async, islands, routing, data-and-actions, server,
  rendering-modes, head.
- Or from the terminal: \`npx lumen docs <topic or words>\`, and \`npx lumen explain LUMxxxx\`.
- Or, when the Lumen MCP server (\`npx lumen mcp\`) is registered, its \`docs_search\` and
  \`docs_get\` tools; its \`check\`, \`render\` and \`dev_logs\` tools serve step 3.

## 2. Make the change

- Page: \`src/routes/<path>.stsx\` exporting a default component (may be \`async\`) taking
  \`PageProps<"/blog/[slug]">\`; params come from \`[name]\` segments, links from \`href()\`.
- Endpoint: \`src/routes/<path>.ts\` exporting \`GET\`/\`POST\`/… typed \`Endpoint<"/api/x">\`.
- Form: export \`actions = { name(ctx: ActionContext<"/path">) {…} }\` from the page, post to
  \`?/name\`, read the result with \`actionData<typeof actions>()\`; return \`fail(status, data)\`
  or call \`redirect()\`.
- Interactivity in a \`static\`/\`server\` page: an exported component in \`src/components\`, used
  with \`client:load\` or \`client:visible\` and plain-data props.
- Styles: a \`<style>\` block inside the component's root element (scoped), \`<style global>\` for
  globals, \`$constant\` for module-level values, \`style={{ "--x": value() }}\` for runtime values.
- Mode: \`export const mode = "server"\` for request data (cookies, sessions, per-request HTML).

## 3. Verify

1. \`npx lumen check --format json\`: fix each diagnostic until \`"ok": true\`
   (\`npx lumen explain <code>\` for the fix).
2. \`npx lumen routes\` when routes changed: patterns, modes and layouts as intended.
3. \`npx lumen lint\` and \`npx lumen fmt\`.
4. Behaviour: \`npx lumen dev --format json\` prints \`{ "url": … }\` once listening; fetch the page.
   \`npx lumen build\` prerenders static routes and fails on route errors.
`;
}

export interface AgentFile {
  /** Project-relative path. */
  file: string;
  action: "created" | "updated" | "unchanged";
  content: string;
}

export interface AgentFilesOptions {
  /** Project name for a new `AGENTS.md`. Default: the directory name. */
  name?: string;
  /**
   * Also register `lumen mcp` for Claude Code (`.mcp.json`) and Codex (`.codex/config.toml`),
   * run with this package manager (decision-26 §5).
   */
  mcp?: PackageManager;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export const MCP_JSON = ".mcp.json";
export const CODEX_CONFIG = ".codex/config.toml";

/** How a package manager runs the project's own `lumen` binary: `pnpm exec lumen mcp`, … */
export function mcpCommand(pm: PackageManager): { command: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["exec", "lumen", "mcp"] };
    case "yarn":
      return { command: "yarn", args: ["lumen", "mcp"] };
    case "bun":
      return { command: "bunx", args: ["lumen", "mcp"] };
    default:
      return { command: "npx", args: ["lumen", "mcp"] };
  }
}

/**
 * The package manager of the project in `read`'s view: its lockfile, else the `packageManager`
 * field of `package.json`, else `fallback` (create-lumen: the one that ran it), else npm.
 */
export function detectPackageManager(
  read: (file: string) => string | undefined,
  fallback?: PackageManager,
): PackageManager {
  if (read("pnpm-lock.yaml") !== undefined) return "pnpm";
  if (read("yarn.lock") !== undefined) return "yarn";
  if (read("bun.lock") !== undefined || read("bun.lockb") !== undefined) return "bun";
  if (read("package-lock.json") !== undefined) return "npm";
  const field = /"packageManager"\s*:\s*"(npm|pnpm|yarn|bun)@/.exec(read("package.json") ?? "");
  return (field?.[1] as PackageManager | undefined) ?? fallback ?? "npm";
}

/** `.mcp.json` with the `lumen` server added or updated; other servers and keys are kept. */
function mcpJson(current: string | undefined, pm: PackageManager): string {
  let config: { mcpServers?: Record<string, unknown> } & Record<string, unknown> = {};
  if (current !== undefined && current.trim() !== "") {
    const parsed: unknown = JSON.parse(current);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${MCP_JSON} is not a JSON object.`);
    }
    config = parsed as typeof config;
  }
  const servers = { ...config.mcpServers, lumen: mcpCommand(pm) };
  return `${JSON.stringify({ ...config, mcpServers: servers }, null, 2)}\n`;
}

/**
 * `.codex/config.toml` with an `[mcp_servers.lumen]` table: replaced when present (up to the
 * next table that is not one of its subtables), else appended. The rest is kept as it is.
 */
function codexConfig(current: string | undefined, pm: PackageManager): string {
  const { command, args } = mcpCommand(pm);
  const table = [
    "[mcp_servers.lumen]",
    `command = ${JSON.stringify(command)}`,
    `args = [${args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
  ].join("\n");
  if (current === undefined || current.trim() === "") return `${table}\n`;
  const lines = current.split("\n");
  const start = lines.findIndex((line) => line.trim() === "[mcp_servers.lumen]");
  if (start === -1) return `${current.trimEnd()}\n\n${table}\n`;
  let end = start + 1;
  while (end < lines.length) {
    const header = /^\s*\[\[?([^\]]+)\]/.exec(lines[end]!);
    if (header && !header[1]!.trim().startsWith("mcp_servers.lumen.")) break;
    end++;
  }
  const rest = lines.slice(end);
  return [...lines.slice(0, start), table, ...(rest.length > 0 ? ["", ...rest] : [])]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n*$/, "\n");
}

/**
 * The agent files for a project whose current files are read with `read` (undefined: missing):
 * new files in full; in existing ones only the Lumen section, the `@AGENTS.md` reference and the
 * `.gitattributes` line are added or updated.
 */
export function planAgentFiles(
  read: (file: string) => string | undefined,
  options: AgentFilesOptions & { name: string },
): AgentFile[] {
  const plan = (file: string, next: (current: string | undefined) => string): AgentFile => {
    const current = read(file);
    const content = next(current);
    const action =
      current === undefined ? "created" : current === content ? "unchanged" : "updated";
    return { file, action, content };
  };
  return [
    plan("AGENTS.md", (current) => {
      if (current === undefined)
        return `# ${options.name}\n\nGuidance for coding agents.\n\n${agentsSection()}`;
      const start = current.indexOf(AGENTS_START);
      const end = current.indexOf(AGENTS_END, start);
      if (start !== -1 && end !== -1) {
        return (
          current.slice(0, start) +
          agentsSection().trimEnd() +
          current.slice(end + AGENTS_END.length)
        );
      }
      return `${current.trimEnd()}\n\n${agentsSection()}`;
    }),
    plan("CLAUDE.md", (current) => {
      if (current === undefined) return "Follow the instructions in @AGENTS.md\n";
      return current.includes("AGENTS.md")
        ? current
        : `${current.trimEnd()}\n\nFollow the instructions in @AGENTS.md\n`;
    }),
    plan(SKILL_FILE, () => skillFile()),
    plan(".gitattributes", (current) => {
      if (current === undefined) return `${GITATTRIBUTES_LINE}\n`;
      const has = current.split("\n").some((line) => line.trim() === GITATTRIBUTES_LINE);
      return has
        ? current
        : `${current.trimEnd()}${current.trim() ? "\n" : ""}${GITATTRIBUTES_LINE}\n`;
    }),
    // Only a missing tsconfig is written (decision-25); `lumen check` reviews an existing one.
    ...(read("tsconfig.json") === undefined ? [plan("tsconfig.json", formatTsconfig)] : []),
    ...(options.mcp === undefined
      ? []
      : [
          plan(MCP_JSON, (current) => mcpJson(current, options.mcp!)),
          plan(CODEX_CONFIG, (current) => codexConfig(current, options.mcp!)),
        ]),
  ];
}

/** Writes the agent files into `root` (see {@link planAgentFiles}); unchanged files are not rewritten. */
export async function agentsInit(
  root: string,
  options: AgentFilesOptions = {},
): Promise<AgentFile[]> {
  const current = new Map<string, string | undefined>();
  const files = ["AGENTS.md", "CLAUDE.md", SKILL_FILE, ".gitattributes", "tsconfig.json"];
  if (options.mcp !== undefined) files.push(MCP_JSON, CODEX_CONFIG);
  for (const file of files) {
    current.set(file, await readFile(join(root, file), "utf8").catch(() => undefined));
  }
  const planned = planAgentFiles((file) => current.get(file), {
    ...options,
    name: options.name ?? basename(root),
  });
  for (const { file, action, content } of planned) {
    if (action === "unchanged") continue;
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  return planned;
}

/** What to tell the user after registering the MCP server: Codex only reads trusted projects. */
export function mcpNote(pm: PackageManager): string {
  const { command, args } = mcpCommand(pm);
  return (
    `Codex reads ${CODEX_CONFIG} only in trusted projects; otherwise register the server with: ` +
    `codex mcp add lumen -- ${[command, ...args].join(" ")}`
  );
}

export interface AgentsCommandOptions {
  root: string;
  /** Also register `lumen mcp` for Claude Code and Codex. */
  mcp?: boolean;
  format: OutputFormat;
  write: (text: string) => void;
  writeError: (text: string) => void;
}

/** `lumen agents init`: writes or updates the agent files; exit 0, or 2 when it cannot write. */
export async function agentsCommand(options: AgentsCommandOptions): Promise<number> {
  let files: AgentFile[];
  let pm: PackageManager | undefined;
  try {
    const root = projectRoot(options.root);
    if (options.mcp) {
      const read = (file: string) => (existsSync(join(root, file)) ? "" : undefined);
      const pkg = await readFile(join(root, "package.json"), "utf8").catch(() => undefined);
      pm = detectPackageManager((file) => (file === "package.json" ? pkg : read(file)));
    }
    files = await agentsInit(root, pm === undefined ? {} : { mcp: pm });
  } catch (error) {
    const failure = failureOf(error);
    if (options.format === "json") options.write(formatEnvelope("agents", false, { failure }));
    else options.writeError(`lumen agents init failed: ${failure.message}\n`);
    return EXIT_FAILURE;
  }
  if (options.format === "json") {
    options.write(
      formatEnvelope("agents", true, {
        files: files.map(({ file, action }) => ({ file, action })),
        ...(pm === undefined ? {} : { mcp: { ...mcpCommand(pm), note: mcpNote(pm) } }),
      }),
    );
  } else {
    const width = Math.max(...files.map(({ action }) => action.length));
    for (const { file, action } of files) options.write(`  ${action.padEnd(width)}  ${file}\n`);
    if (pm !== undefined) options.write(`\n${mcpNote(pm)}\n`);
  }
  return EXIT_OK;
}
