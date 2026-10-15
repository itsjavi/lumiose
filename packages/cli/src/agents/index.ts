// Agent setup files (spec §10, decision-10): `AGENTS.md` (a Lumiose section between markers),
// `CLAUDE.md` referencing it, the `lumiose` skill, the `.gitattributes` line for `.stsx` and, when
// missing, a `tsconfig.json` that extends the generated one (decision-25). A project that depends
// on @lumiose/ui also gets a UI part in the Lumiose section and the `lumiose-ui` skill
// (decision-64). Written by `lumiose agents init` for existing projects and by create-lumiose for
// new ones (`@lumiose/cli/agents`). Re-running updates Lumiose's parts and leaves everything else in
// these files alone.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { formatTsconfig } from "../check/tsconfig.ts";
import { EXIT_FAILURE, EXIT_OK, failureOf, formatEnvelope, type OutputFormat } from "../output.ts";
import { projectRoot } from "../project.ts";

export const AGENTS_START =
  "<!-- lumiose:start (managed by `lumiose agents init`; edit outside the markers) -->";
export const AGENTS_END = "<!-- lumiose:end -->";
export const SKILL_FILE = ".claude/skills/lumiose/SKILL.md";
export const UI_SKILL_FILE = ".claude/skills/lumiose-ui/SKILL.md";
export const GITATTRIBUTES_LINE = "*.stsx linguist-language=TSX";

/** Whether a `package.json` lists @lumiose/ui as a dependency of any kind. */
export function dependsOnUi(packageJson: string | undefined): boolean {
  if (packageJson === undefined) return false;
  try {
    const manifest = JSON.parse(packageJson) as Record<string, unknown>;
    return ["dependencies", "devDependencies", "peerDependencies"].some((field) => {
      const deps = manifest[field];
      return typeof deps === "object" && deps !== null && "@lumiose/ui" in deps;
    });
  } catch {
    return false;
  }
}

/** The UI part of the Lumiose section, for projects that depend on @lumiose/ui. */
function uiSection(): string {
  return `
### UI components (\`@lumiose/ui\`)

This project uses \`@lumiose/ui\`: accessible, unstyled components on native elements (\`<dialog>\`,
popovers, invoker commands), server-rendered without hydration. Use them instead of hand-rolling
dialogs, drawers, menus, context menus, popovers, tabs, accordions or toasts, and follow the
\`lumiose-ui\` skill.

- Its docs match the installed version: \`node_modules/@lumiose/ui/docs/llms.txt\` lists one page
  per component (anatomy, API, example, styling, keyboard). \`npx lumiose docs ui\` and
  \`npx lumiose docs dialog\` print them; the MCP server's \`ui_components\` tool lists every
  component's parts, props, events and styling hooks.
- Compose the documented parts (\`Dialog.Root\` > \`Dialog.Trigger\`, \`Dialog.Popup\` >
  \`Dialog.Title\`); each part takes the props of the element it renders (\`class\`, \`aria-*\`,
  events). Keep state in a signal with \`bind:open={open}\`, or \`open\` plus \`onOpenChange\`.
- Unstyled: \`@lumiose/ui/styles.css\` (layer \`lu.core\`) and the optional
  \`@lumiose/ui/themes/default.css\` (layer \`lu.theme\`, \`--lu-\` custom properties). Style parts
  through \`class\` and native or ARIA state (\`dialog[open]\`, \`[aria-expanded="true"]\`,
  \`[data-highlighted]\`); unlayered CSS wins over both layers.
- Keep them accessible: every dialog has a \`Dialog.Title\` (or an \`aria-label\` on its \`Popup\`),
  icon-only triggers get an \`aria-label\`, focus stays visible, and the roles, ids and ARIA
  wiring the parts set are left alone.
`;
}

/** The Lumiose section of `AGENTS.md`, markers included (with the UI part when `ui`). */
export function agentsSection(options: { ui?: boolean } = {}): string {
  return `${AGENTS_START}
## Lumiose

This project uses Lumiose, a web framework for everything from static sites and SPAs to full-stack apps:
TSX with scoped CSS built in, signals, and 0 kB of JavaScript until a page needs it. Components
live in \`.stsx\` files (TSX plus raw-CSS \`<style>\` blocks), are set up once and update through
signals; routes are file-based, with TypeScript 7. It is not React, Solid or Svelte: check the
docs instead of guessing.

### Read the local docs first

- The docs for the installed version are in \`node_modules/lumiose/docs\`. Start from the index,
  \`node_modules/lumiose/docs/llms.txt\`, and read the page for the task before writing code.
- \`npx lumiose docs <topic>\` prints or searches them (\`npx lumiose docs signals\`,
  \`npx lumiose docs "form action"\`); \`npx lumiose explain <code>\` explains a diagnostic such as
  \`LUM2001\`.
- With MCP support, use the Lumiose MCP server (\`npx lumiose agents init --mcp\` registers it for
  Claude Code and Codex; elsewhere run \`npx lumiose mcp\` over stdio): docs, \`check\` with fixes,
  routes, components, compiler output, rendered HTML and dev logs as tools.

### \`.stsx\` files

- \`.stsx\` is TSX plus raw-CSS \`<style>\` blocks. Read and edit everything outside \`<style>\` as
  TSX; the inside of a \`<style>\` block is plain CSS, not a string or CSS-in-JS.
- Convention: one top-level \`<style>\` at the end of the file, after the components. It styles
  every component in the file, so they share it. \`$name\` in CSS reads a top-level \`const\`
  declared above the block (\`$theme.gap\` for object members). \`<style global>\` is global.
- Nest a block inside an intrinsic element only to scope that element's subtree or to read a
  \`const\` declared in the component; never in \`{…}\`, conditionals or \`.map\` (\`LUM3010\`).
  When moving rules to the file-level block, check that no selector starts matching another
  component of the file. \`.tsx\` files cannot have \`<style>\` (\`LUM1006\`); \`.ts\` files hold
  non-UI code.
- Import with the extension: \`import { Card } from "./Card.stsx";\`.

### Key rules

- Components run once. Read a signal by calling it, \`count()\`, where the value is needed;
  \`const n = count()\` in the body is frozen (\`LUM2001\`). Derive with \`() => …\` or \`computed\`.
- No early returns on reactive state; put conditions in JSX (\`LUM2003\`). Write signals in
  handlers and effects, never in the component body (\`LUM2002\`).
- Use \`class\` and \`for\` (not \`className\`/\`htmlFor\`), \`onClick\`-style events,
  \`style={{ "font-weight": 600 }}\` and \`bind:value={signal}\`. Lists are plain \`.map\` with \`key\`.
- Routes are folders in \`src/routes\` with the Next.js App Router file names: \`page.stsx\`,
  \`layout.stsx\`, \`not-found.stsx\`, \`error.stsx\`, \`route.ts\` endpoints exporting \`GET\`/\`POST\`,
  and \`[param]\`, \`[[param]]\`, \`[...rest]\`, \`[[...rest]]\`, \`(group)\` folders. The project's default mode is \`lumiose({ mode })\` in \`vite.config.ts\`; a route or
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
- Any other file in \`src/routes\` is a colocated module, never a route, and \`_name\` folders are
  private. Modules shared across routes go in \`src/lib\` or \`src/components\`.
${options.ui ? uiSection() : ""}
### Before you finish

Run \`npx lumiose check\` (types, routes and Lumiose diagnostics; \`--format json\` for a
\`{ command, ok, diagnostics }\` report) and fix every error, then \`npx lumiose lint\` and
\`npx lumiose fmt\`. \`npx lumiose routes\` lists the routes with their modes. Every CLI command takes
\`--format json\` and exits 0 on success, 1 when it finds problems, 2 when it cannot run.
${AGENTS_END}
`;
}

/** The `lumiose` skill bundle (Claude Code and other agents that read `.claude/skills`). */
export function skillFile(): string {
  return `---
name: lumiose
description: Build, change and fix Lumiose apps (.stsx components with TSX and raw-CSS <style> blocks, signals, file routes in src/routes, islands, form actions). Use for any edit to .stsx/.tsx components, routes, endpoints or lumiose() options in vite.config.ts, and whenever lumiose check reports LUMxxxx diagnostics.
---

# Lumiose

Follow the Lumiose section of \`AGENTS.md\`. This skill is the workflow.

## 1. Look it up

- Index: \`node_modules/lumiose/docs/llms.txt\` (version-matched docs). Read the concept page for the
  task: components, signals, jsx, styles, async, islands, routing, data-and-actions, server,
  rendering-modes, head.
- Or from the terminal: \`npx lumiose docs <topic or words>\`, and \`npx lumiose explain LUMxxxx\`.
- Or, when the Lumiose MCP server (\`npx lumiose mcp\`) is registered, its \`docs_search\` and
  \`docs_get\` tools; its \`check\`, \`render\` and \`dev_logs\` tools serve step 3.

## 2. Make the change

- Page: \`src/routes/<path>/page.stsx\` exporting a default component (may be \`async\`) taking
  \`PageProps<"/blog/[slug]">\`; params come from \`[name]\` segments, links from \`href()\`.
- Endpoint: \`src/routes/<path>/route.ts\` exporting \`GET\`/\`POST\`/… typed \`Endpoint<"/api/x">\`.
- Form: export \`actions = { name(ctx: ActionContext<"/path">) {…} }\` from the page, post to
  \`?/name\`, read the result with \`actionData<typeof actions>()\`; return \`fail(status, data)\`
  or call \`redirect()\`.
- Interactivity in a \`static\`/\`server\` page: an exported component in \`src/components\`, used
  with \`client:load\` or \`client:visible\` and plain-data props.
- Styles: one \`<style>\` block at the end of the file, shared by its components (scoped to the
  file); a block nested in an element only to scope its subtree or read a component \`const\`;
  \`<style global>\` for globals, \`$constant\` for top-level values,
  \`style={{ "--x": value() }}\` for runtime values.
- Mode: \`export const mode = "server"\` for request data (cookies, sessions, per-request HTML).

## 3. Verify

1. \`npx lumiose check --format json\`: fix each diagnostic until \`"ok": true\`
   (\`npx lumiose explain <code>\` for the fix).
2. \`npx lumiose routes\` when routes changed: patterns, modes and layouts as intended.
3. \`npx lumiose lint\` and \`npx lumiose fmt\`.
4. Behaviour: \`npx lumiose dev --format json\` prints \`{ "url": … }\` once listening; fetch the page.
   \`npx lumiose build\` prerenders static routes and fails on route errors.
`;
}

/** The `lumiose-ui` skill, for projects that depend on @lumiose/ui (decision-64). */
export function uiSkillFile(): string {
  return `---
name: lumiose-ui
description: Build UI with @lumiose/ui in a Lumiose app (Dialog and the other accessible, unstyled components on native elements): composing parts, bind: and events, styling with classes, state selectors, the lu.core and lu.theme layers and --lu- variables, and the accessibility rules. Use for any dialog, drawer, popover, tooltip, menu, context menu, tabs, select, combobox, accordion, collapsible or toast, and when styling @lumiose/ui parts.
---

# @lumiose/ui

Follow the UI part of the Lumiose section of \`AGENTS.md\`. This skill is the workflow.

## 1. Find the component

- Index: \`node_modules/@lumiose/ui/docs/llms.txt\` (the docs of the installed version). Each
  component page has the same sections: Anatomy, API, Example, Styling, Keyboard and focus,
  Without JavaScript, Browser support, Related.
- Or \`npx lumiose docs ui\` (the overview and the component list) and \`npx lumiose docs dialog\`.
- Or, with the Lumiose MCP server, \`ui_components\` (every component's parts, props, events and
  styling hooks) and \`docs_get("ui/dialog")\`.
- Prefer a component over hand-written markup and scripts: it brings the keyboard contract, focus
  handling and ARIA wiring.

## 2. Compose the parts

- Import from \`@lumiose/ui\` or the component's entry (\`@lumiose/ui/dialog\`), and use the parts
  in the nesting the Anatomy shows: \`Dialog.Root\` holds the state, \`Dialog.Trigger\` and
  \`Dialog.Popup\` go inside it, \`Dialog.Title\`, \`Dialog.Description\` and \`Dialog.Close\` inside
  the popup.
- Every part takes the props of the element it renders (\`class\`, \`style\`, \`aria-*\`, \`data-*\`,
  events, \`ref\`) and passes them through. The ids and commands that connect the parts are
  theirs: do not set \`id\`, \`command\` or \`commandfor\` on them.
- In a server-rendered page the components work without an island: native elements, and a small
  client script the page loads by itself. Controlled state (\`open\`, \`onOpenChange\`, \`bind:\`)
  needs the component to run in the browser, inside an island (\`client:load\`).

## 3. State and events

- A component's state is a prop and a callback: \`open\` with \`onOpenChange\`, \`value\` with
  \`onValueChange\`, \`checked\` with \`onCheckedChange\`. Leave both out and the element keeps its
  own state.
- \`bind:open={open}\` passes a signal both ways: it is short for \`open={open()}\` plus
  \`onOpenChange={(next) => open.set(next)}\`, and works for every prop \`x\` with an \`onXChange\`.
- Native events of the rendered element use \`on:\` (\`on:close\` on \`Dialog.Popup\`); custom
  elements report changes with lowercase DOM events (\`openchange\`, \`change\`).

## 4. Style

- The package is unstyled. \`@lumiose/ui/styles.css\` (or a component's own, such as
  \`@lumiose/ui/dialog.css\`) holds only what the components need to work, in the \`lu.core\` layer.
  Import it once, in the root layout.
- \`@lumiose/ui/themes/default.css\` is the optional default theme, in the \`lu.theme\` layer: put
  its classes on the parts (\`lu-button\`, \`lu-dialog\`, …, listed in each page's Styling section)
  and change its colours and radius through its \`--lu-\` custom properties (shadcn/ui's names:
  \`--lu-primary\`, \`--lu-background\`, \`--lu-radius\`, …). It follows light and dark.
- Your own CSS is unlayered, so it wins over both layers without specificity tricks. If the app
  orders its layers, put \`lu\` first: \`@layer lu, base, components;\`.
- Style state through native and ARIA selectors, not extra classes: \`dialog[open]\`, \`:modal\`,
  \`::backdrop\`, \`:popover-open\`, \`[aria-expanded="true"]\`, \`[aria-checked="true"]\`,
  \`[aria-selected="true"]\`, and \`[data-highlighted]\` on the active item of a list.
- Animate opening and closing with \`@starting-style\` and \`allow-discrete\` transitions of
  \`display\` and \`overlay\`, inside \`@media (prefers-reduced-motion: no-preference)\`, as the
  Styling sections show.

## 5. Keep it accessible

@lumiose/ui targets WCAG 2.2 AA when its components are used as documented. Keep it that way:

- A dialog needs a name: a \`Dialog.Title\`, or an \`aria-label\` on \`Dialog.Popup\`. Use
  \`role="alertdialog"\` on \`Dialog.Root\` for a confirmation that needs an answer.
- A trigger with only an icon needs an \`aria-label\`; never put interactive elements inside a
  trigger or a close button.
- Do not remove or override the roles, \`aria-*\` wiring and \`tabindex\` the parts set; pass
  \`aria-*\` only to add a label or a description.
- Popups opened from a modal dialog (a menu, a select) go inside its \`Popup\`: everything outside
  a modal dialog is inert.
- Keep a visible focus style (\`:focus-visible\`) and, when changing theme colours, a contrast of
  4.5:1 for text and 3:1 for borders and focus rings.

## 6. Verify

1. \`npx lumiose check --format json\`: the parts' props are typed; fix every error.
2. Try it without JavaScript where the page is server-rendered: triggers and close buttons still
   work, as the component's "Without JavaScript" section says.
3. Use the keyboard: the keys in the component's "Keyboard and focus" table.
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
   * Also register `lumiose mcp` for Claude Code (`.mcp.json`) and Codex (`.codex/config.toml`),
   * run with this package manager (decision-26 §5).
   */
  mcp?: PackageManager;
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export const MCP_JSON = ".mcp.json";
export const CODEX_CONFIG = ".codex/config.toml";

/** How a package manager runs the project's own `lumiose` binary: `pnpm exec lumiose mcp`, … */
export function mcpCommand(pm: PackageManager): { command: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["exec", "lumiose", "mcp"] };
    case "yarn":
      return { command: "yarn", args: ["lumiose", "mcp"] };
    case "bun":
      return { command: "bunx", args: ["lumiose", "mcp"] };
    default:
      return { command: "npx", args: ["lumiose", "mcp"] };
  }
}

/**
 * The package manager of the project in `read`'s view: its lockfile, else the `packageManager`
 * field of `package.json`, else `fallback` (create-lumiose: the one that ran it), else npm.
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

/** `.mcp.json` with the `lumiose` server added or updated; other servers and keys are kept. */
function mcpJson(current: string | undefined, pm: PackageManager): string {
  let config: { mcpServers?: Record<string, unknown> } & Record<string, unknown> = {};
  if (current !== undefined && current.trim() !== "") {
    const parsed: unknown = JSON.parse(current);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${MCP_JSON} is not a JSON object.`);
    }
    config = parsed as typeof config;
  }
  const servers = { ...config.mcpServers, lumiose: mcpCommand(pm) };
  return `${JSON.stringify({ ...config, mcpServers: servers }, null, 2)}\n`;
}

/**
 * `.codex/config.toml` with an `[mcp_servers.lumiose]` table: replaced when present (up to the
 * next table that is not one of its subtables), else appended. The rest is kept as it is.
 */
function codexConfig(current: string | undefined, pm: PackageManager): string {
  const { command, args } = mcpCommand(pm);
  const table = [
    "[mcp_servers.lumiose]",
    `command = ${JSON.stringify(command)}`,
    `args = [${args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
  ].join("\n");
  if (current === undefined || current.trim() === "") return `${table}\n`;
  const lines = current.split("\n");
  const start = lines.findIndex((line) => line.trim() === "[mcp_servers.lumiose]");
  if (start === -1) return `${current.trimEnd()}\n\n${table}\n`;
  let end = start + 1;
  while (end < lines.length) {
    const header = /^\s*\[\[?([^\]]+)\]/.exec(lines[end]!);
    if (header && !header[1]!.trim().startsWith("mcp_servers.lumiose.")) break;
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
 * new files in full; in existing ones only the Lumiose section, the `@AGENTS.md` reference and the
 * `.gitattributes` line are added or updated. A `package.json` that depends on @lumiose/ui adds
 * the UI part and the `lumiose-ui` skill.
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
  const ui = dependsOnUi(read("package.json"));
  const section = agentsSection({ ui });
  return [
    plan("AGENTS.md", (current) => {
      if (current === undefined)
        return `# ${options.name}\n\nGuidance for coding agents.\n\n${section}`;
      const start = current.indexOf(AGENTS_START);
      const end = current.indexOf(AGENTS_END, start);
      if (start !== -1 && end !== -1) {
        return current.slice(0, start) + section.trimEnd() + current.slice(end + AGENTS_END.length);
      }
      return `${current.trimEnd()}\n\n${section}`;
    }),
    plan("CLAUDE.md", (current) => {
      if (current === undefined) return "Follow the instructions in @AGENTS.md\n";
      return current.includes("AGENTS.md")
        ? current
        : `${current.trimEnd()}\n\nFollow the instructions in @AGENTS.md\n`;
    }),
    plan(SKILL_FILE, () => skillFile()),
    ...(ui ? [plan(UI_SKILL_FILE, () => uiSkillFile())] : []),
    plan(".gitattributes", (current) => {
      if (current === undefined) return `${GITATTRIBUTES_LINE}\n`;
      const has = current.split("\n").some((line) => line.trim() === GITATTRIBUTES_LINE);
      return has
        ? current
        : `${current.trimEnd()}${current.trim() ? "\n" : ""}${GITATTRIBUTES_LINE}\n`;
    }),
    // Only a missing tsconfig is written (decision-25); `lumiose check` reviews an existing one.
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
  const files = [
    "AGENTS.md",
    "CLAUDE.md",
    SKILL_FILE,
    UI_SKILL_FILE,
    ".gitattributes",
    "tsconfig.json",
    "package.json",
  ];
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
    `codex mcp add lumiose -- ${[command, ...args].join(" ")}`
  );
}

export interface AgentsCommandOptions {
  root: string;
  /** Also register `lumiose mcp` for Claude Code and Codex. */
  mcp?: boolean;
  format: OutputFormat;
  write: (text: string) => void;
  writeError: (text: string) => void;
}

/** `lumiose agents init`: writes or updates the agent files; exit 0, or 2 when it cannot write. */
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
    else options.writeError(`lumiose agents init failed: ${failure.message}\n`);
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
