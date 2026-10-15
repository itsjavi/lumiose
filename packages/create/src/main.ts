// `create-lumiose [dir] [--template <name>]` (`pnpm create lumiose`): asks for what is missing when run
// in a terminal, or takes the defaults with --yes (and in non-interactive runs). Output follows the
// lumiose CLI contract: exit 0 created, 1 cannot create there, 2 misuse; `--format json` prints
// `{ command: "create", ok, ... }`.

import { createInterface } from "node:readline/promises";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { mcpCommand, mcpNote, type PackageManager } from "@lumiose/cli/agents";
import pkg from "../package.json" with { type: "json" };
import {
  DEFAULT_TEMPLATE,
  scaffold,
  ScaffoldError,
  TEMPLATES,
  UI_PACKAGE,
  type TemplateName,
} from "./scaffold.ts";

export interface CreateIO {
  cwd: string;
  write: (text: string) => void;
  writeError: (text: string) => void;
  /** Interactive questions; undefined when stdin is not a terminal. */
  ask?: (question: string) => Promise<string>;
  /** `npm_config_user_agent`, for the next-step commands. */
  userAgent?: string;
}

export interface CreateOptions {
  /**
   * Offer @lumiose/ui (the `--ui` flag and its question). Default: once the package is on npm
   * (TASK-389); tests turn it on against the workspace package.
   */
  offerUi?: boolean;
}

const usage = (offerUi: boolean) => `Usage: create-lumiose [dir] [options]

Create a Lumiose app in <dir> (asked for when missing in a terminal; default: lumiose-app).

Options:
  -t, --template <name>  ${TEMPLATES.map((template) => template.name).join(" | ")} (default: ${DEFAULT_TEMPLATE})
  --name <name>          Package name (default: from the directory name)
  -y, --yes              Ask nothing: use the defaults
  --force                Write into a non-empty directory (same-name files are overwritten)
  --mcp                  Register the Lumiose MCP server for Claude Code (.mcp.json) and Codex
                         (.codex/config.toml), run with your package manager
${
  offerUi
    ? `  --ui                   Add @lumiose/ui: accessible, unstyled components with the default theme,
                         and their agent docs and skill
`
    : ""
}  --format <format>      human (default) or json: { command: "create", ok, ... } on stdout
  -h, --help             Show this help
  -v, --version          Show the version

Templates:
${TEMPLATES.map((template) => `  ${template.name.padEnd(8)} ${template.description} (mode: ${template.mode})`).join("\n")}

Exit codes: 0 created, 1 the directory cannot be used, 2 misuse.

Examples:
  pnpm create lumiose my-app --template ssr
  create-lumiose my-site -t static --yes --format json
  pnpm create lumiose my-app --mcp
`;

export async function main(
  argv: string[],
  io: CreateIO = processIO(),
  options: CreateOptions = {},
): Promise<number> {
  const offerUi = options.offerUi ?? UI_PACKAGE?.published === true;
  const json = argv.some(
    (arg, index) => arg === "--format=json" || (arg === "--format" && argv[index + 1] === "json"),
  );
  const usageError = (message: string) => {
    if (json) {
      io.write(envelope(false, { failure: { message, help: 'Run "create-lumiose --help".' } }));
    } else
      io.writeError(`create-lumiose: ${message}\nRun "create-lumiose --help" for the options.\n`);
    return 2;
  };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        template: { type: "string", short: "t" },
        name: { type: "string" },
        yes: { type: "boolean", short: "y" },
        force: { type: "boolean" },
        mcp: { type: "boolean" },
        ui: { type: "boolean" },
        format: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    return usageError((error as Error).message);
  }
  const { values, positionals } = parsed;
  if (values.format !== undefined && values.format !== "human" && values.format !== "json") {
    return usageError(`--format must be "human" or "json", not "${values.format}".`);
  }
  if (values.help) {
    io.write(usage(offerUi));
    return 0;
  }
  if (values.version) {
    io.write(json ? envelope(true, { version: pkg.version }) : `create-lumiose ${pkg.version}\n`);
    return 0;
  }
  if (positionals.length > 1) return usageError(`Unexpected argument "${positionals[1]}".`);
  if (values.ui && !offerUi) {
    return usageError("--ui comes with the first release of @lumiose/ui, which is not on npm yet.");
  }
  if (values.template !== undefined && !isTemplate(values.template)) {
    return usageError(
      `Unknown template "${values.template}". Pick one of: ${TEMPLATES.map((t) => t.name).join(", ")}.`,
    );
  }

  const ask = values.yes || json ? undefined : io.ask;
  let dir = positionals[0];
  if (dir === undefined && ask) dir = (await ask("Project directory (lumiose-app): ")).trim();
  dir ||= "lumiose-app";
  let template = values.template as TemplateName | undefined;
  if (template === undefined && ask) template = await askTemplate(ask);
  template ??= DEFAULT_TEMPLATE;
  let ui = values.ui ?? false;
  if (values.ui === undefined && offerUi && ask) {
    const answer = await ask(
      "Add @lumiose/ui, accessible UI components with a default theme? (y/N): ",
    );
    ui = /^y(?:es)?$/i.test(answer.trim());
  }

  const pm = packageManager(io.userAgent);
  let result;
  try {
    result = await scaffold({
      dir: resolve(io.cwd, dir),
      template,
      ...(values.name === undefined ? {} : { name: values.name }),
      force: values.force ?? false,
      ...(values.mcp ? { mcp: pm } : {}),
      ...(ui ? { ui } : {}),
    });
  } catch (error) {
    if (!(error instanceof ScaffoldError)) throw error;
    if (json) io.write(envelope(false, { failure: { message: error.message } }));
    else io.writeError(`create-lumiose: ${error.message}\n`);
    return 1;
  }

  const fromCwd = relative(io.cwd, result.dir);
  const cd = fromCwd.startsWith("..") ? result.dir : fromCwd || ".";
  const next = [
    ...(cd === "." ? [] : [`cd ${cd.includes(" ") ? JSON.stringify(cd) : cd}`]),
    `${pm} install`,
    `${pm} ${pm === "npm" ? "run dev" : "dev"}`,
  ];
  if (json) {
    io.write(
      envelope(true, {
        dir: result.dir,
        name: result.name,
        template: result.template.name,
        mode: result.template.mode,
        files: result.files,
        ui,
        next,
        ...(values.mcp ? { mcp: { ...mcpCommand(pm), note: mcpNote(pm) } } : {}),
      }),
    );
  } else {
    io.write(
      `\nCreated ${result.name} in ${result.dir} (template: ${result.template.name}, mode: ${result.template.mode}).\n` +
        `Agent-ready: AGENTS.md, CLAUDE.md and the lumiose skill (.claude/skills/lumiose).\n` +
        (ui
          ? "UI: @lumiose/ui with its default theme, and the lumiose-ui skill (.claude/skills/lumiose-ui).\n"
          : "") +
        (values.mcp
          ? `MCP: .mcp.json (Claude Code) and .codex/config.toml (Codex) run the Lumiose MCP server.\n${mcpNote(pm)}\n`
          : "") +
        "\n" +
        `Next:\n${next.map((line) => `  ${line}\n`).join("")}`,
    );
  }
  return 0;
}

async function askTemplate(ask: (question: string) => Promise<string>): Promise<TemplateName> {
  const list = TEMPLATES.map(
    (template, index) => `  ${index + 1}. ${template.name.padEnd(8)} ${template.description}`,
  ).join("\n");
  const defaultIndex = TEMPLATES.findIndex((template) => template.name === DEFAULT_TEMPLATE) + 1;
  for (;;) {
    const answer = (await ask(`Template:\n${list}\nPick one (${defaultIndex}): `)).trim();
    if (answer === "") return DEFAULT_TEMPLATE;
    const picked = TEMPLATES[Number(answer) - 1]?.name ?? (isTemplate(answer) ? answer : undefined);
    if (picked) return picked;
  }
}

function isTemplate(name: string): name is TemplateName {
  return TEMPLATES.some((template) => template.name === name);
}

function envelope(ok: boolean, payload: object): string {
  return `${JSON.stringify({ command: "create", ok, ...payload }, null, 2)}\n`;
}

/** The package manager that runs us (`pnpm create lumiose`, `npm create lumiose`, …). */
function packageManager(userAgent: string | undefined): PackageManager {
  const name = userAgent?.split("/")[0];
  return name === "npm" || name === "yarn" || name === "bun" ? name : "pnpm";
}

function processIO(): CreateIO {
  return {
    cwd: process.cwd(),
    write: (text) => void process.stdout.write(text),
    writeError: (text) => void process.stderr.write(text),
    ...(process.stdin.isTTY ? { ask: askInTerminal } : {}),
    ...(process.env["npm_config_user_agent"] === undefined
      ? {}
      : { userAgent: process.env["npm_config_user_agent"] }),
  };
}

async function askInTerminal(question: string): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await readline.question(question);
  } finally {
    readline.close();
  }
}
