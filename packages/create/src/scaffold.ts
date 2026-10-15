// Writes a new Lumiose project: a template's `src/` (and extras), the generated package.json,
// tsconfig.json (extending the generated one, decision-25), vite.config.ts with the template's
// `lumiose({ mode })` (decision-21) and `csp: "strict"` (decision-56), .gitignore and README, then the agent files (AGENTS.md, CLAUDE.md, the lumiose skill,
// .gitattributes) from `@lumiose/cli/agents`, shared with `lumiose agents init`. With `ui`, the app
// also depends on @lumiose/ui, imports its stylesheet and default theme in the root layout, and
// gets its agent files (decision-64).

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { agentsInit, type AgentFile, type PackageManager } from "@lumiose/cli/agents";
import cliPackage from "@lumiose/cli/package.json" with { type: "json" };
import lumiosePackage from "lumiose/package.json" with { type: "json" };
import { formatTsconfig } from "@lumiose/cli/tooling";

export type TemplateName = "minimal" | "static" | "ssr" | "spa";

export interface Template {
  name: TemplateName;
  /** The project default route mode, `lumiose({ mode })`. */
  mode: "static" | "server" | "spa";
  description: string;
}

export const TEMPLATES: readonly Template[] = [
  { name: "minimal", mode: "static", description: "One static page: the smallest Lumiose app" },
  {
    name: "static",
    mode: "static",
    description: "A static site: a layout, pages, a blog with staticPaths() and a 404 page",
  },
  {
    name: "ssr",
    mode: "server",
    description:
      "Rendered per request: streaming, a form action, a JSON endpoint and a Node server",
  },
  {
    name: "spa",
    mode: "spa",
    description: "A client-rendered app: pages and a persistent layout running in the browser",
  },
];

export const DEFAULT_TEMPLATE: TemplateName = "static";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));

/** Tool versions the generated package.json asks for (the Lumiose packages share a version). */
const VERSIONS = {
  lumiose: `^${lumiosePackage.version}`,
  vite: cliPackage.peerDependencies.vite,
  typescript: "^7.0.2",
  oxlint: "^1.87.0",
  oxfmt: "^0.72.0",
};

/**
 * The @lumiose/ui this create-lumiose was released with: it keeps its own versions (decision-54).
 * `published` is false while the package is private (TASK-389): the option stays hidden until then.
 */
export const UI_PACKAGE = readUiPackage();

function readUiPackage(): { version: string; published: boolean } | undefined {
  try {
    const manifest = createRequire(import.meta.url)("@lumiose/ui/package.json") as {
      version: string;
      private?: boolean;
    };
    return { version: manifest.version, published: manifest.private !== true };
  } catch {
    return undefined;
  }
}

/** The stylesheets a project with @lumiose/ui imports in its root layout. */
export const UI_STYLESHEETS = ["@lumiose/ui/styles.css", "@lumiose/ui/themes/default.css"];

/** A problem with the target (not empty, invalid name): the CLI exits with 1. */
export class ScaffoldError extends Error {
  override name = "ScaffoldError";
}

export interface ScaffoldOptions {
  /** Target directory; created if missing. */
  dir: string;
  template: TemplateName;
  /** Package name. Default: derived from the directory name. */
  name?: string;
  /** Write into a non-empty directory, overwriting files with the same names. */
  force?: boolean;
  /**
   * Register `lumiose mcp` for Claude Code (`.mcp.json`) and Codex (`.codex/config.toml`), run with
   * this package manager.
   */
  mcp?: PackageManager;
  /** Add @lumiose/ui: the dependency, its stylesheet and default theme, and its agent files. */
  ui?: boolean;
}

export interface ScaffoldResult {
  /** Absolute target directory. */
  dir: string;
  name: string;
  template: Template;
  /** Written files, project-relative, sorted. */
  files: string[];
  agentFiles: AgentFile[];
}

export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const dir = resolve(options.dir);
  const template = TEMPLATES.find((candidate) => candidate.name === options.template);
  if (!template) throw new ScaffoldError(`Unknown template "${options.template}".`);
  if (options.ui && UI_PACKAGE === undefined) {
    throw new ScaffoldError("@lumiose/ui is not available in this create-lumiose.");
  }
  const name = options.name ?? packageName(basename(dir));
  if (!isValidPackageName(name)) {
    throw new ScaffoldError(
      `"${name}" is not a valid package name: use lowercase letters, digits, "-", "." and "_" (pass --name).`,
    );
  }
  if (!options.force && existsSync(dir) && (await readdir(dir)).some((entry) => entry !== ".git")) {
    throw new ScaffoldError(`${dir} is not empty. Pick a new directory, or pass --force.`);
  }

  const files = new Map<string, string>();
  const templateDir = join(TEMPLATES_DIR, template.name);
  for (const file of await listFiles(templateDir)) {
    const text = await readFile(join(templateDir, file), "utf8");
    files.set(file, text.replaceAll("{{name}}", name));
  }
  // The root layout imports @lumiose/ui's styles for every page; the minimal template has no
  // layout, so its only page does.
  let uiEntry: string | undefined;
  if (options.ui) {
    uiEntry = files.has("src/routes/layout.stsx")
      ? "src/routes/layout.stsx"
      : "src/routes/page.stsx";
    const imports = UI_STYLESHEETS.map((sheet) => `import "${sheet}";\n`).join("");
    files.set(uiEntry, imports + files.get(uiEntry)!);
  }
  files.set("package.json", packageJson(name, template, options.ui ?? false));
  files.set("tsconfig.json", formatTsconfig());
  files.set("vite.config.ts", viteConfig(template));
  files.set(".gitignore", "node_modules\ndist\n.lumiose\n");
  files.set("README.md", readme(name, template, uiEntry));

  for (const [file, text] of files) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), text);
  }
  const agentFiles = await agentsInit(dir, {
    name,
    ...(options.mcp === undefined ? {} : { mcp: options.mcp }),
  });
  return {
    dir,
    name,
    template,
    files: [...files.keys(), ...agentFiles.map((file) => file.file)].toSorted(),
    agentFiles,
  };
}

/** `My App!` → `my-app`. */
export function packageName(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._~-]+/g, "-")
      .replace(/^[-._]+|-+$/g, "") || "lumiose-app"
  );
}

export function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(name) && name.length <= 214;
}

function packageJson(name: string, template: Template, ui: boolean): string {
  const server = template.mode === "server";
  // The adapter serves `lumiose preview` everywhere and is the production server of `ssr`.
  const adapter = { "@lumiose/adapter-node": VERSIONS.lumiose };
  const manifest = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "lumiose dev",
      build: "lumiose build",
      preview: "lumiose preview",
      ...(server ? { start: "node server.ts" } : {}),
      check: "lumiose check",
      lint: "lumiose lint",
      fmt: "lumiose fmt",
    },
    dependencies: {
      ...(server ? adapter : {}),
      ...(ui ? { "@lumiose/ui": `^${UI_PACKAGE!.version}` } : {}),
      lumiose: VERSIONS.lumiose,
    },
    devDependencies: {
      ...(server ? {} : adapter),
      "@lumiose/cli": VERSIONS.lumiose,
      "@lumiose/vite": VERSIONS.lumiose,
      oxfmt: VERSIONS.oxfmt,
      oxlint: VERSIONS.oxlint,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
    },
    engines: { node: ">=24" },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function viteConfig(template: Template): string {
  return `import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    lumiose({
      // The default mode of every route: "static" (built HTML), "server" (rendered per request) or
      // "spa" (rendered in the browser). A route or layout overrides it with \`export const mode\`.
      mode: "${template.mode}",
      // A strict Content Security Policy: a nonce on pages rendered per request, hashes on
      // prerendered ones. The scripts and styles Lumiose and your JSX write get them.
      csp: "strict",
    }),
  ],
});
`;
}

/** The project README; `uiEntry` is the file that imports @lumiose/ui's styles, if any. */
function readme(name: string, template: Template, uiEntry: string | undefined): string {
  const server = template.mode === "server";
  return `# ${name}

${template.description}. Made with Lumiose (\`create-lumiose --template ${template.name}\`).

## Commands

- \`pnpm dev\`: start the dev server with hot reload.
- \`pnpm build\`: build into \`dist/\` and prerender the static routes.
- \`pnpm preview\`: serve the build locally.${server ? "\n- `pnpm start`: serve the build in production (`server.ts`, `@lumiose/adapter-node`)." : ""}
- \`pnpm check\`: type-check and report Lumiose diagnostics (\`--format json\` for tools).
- \`pnpm lint\` and \`pnpm fmt\`: lint and format, \`.stsx\` files and \`<style>\` blocks included.

## Layout

- \`src/routes/\`: one folder per URL segment, with a \`page.stsx\` page or a \`route.ts\` endpoint;
  \`layout.stsx\` wraps the pages below it. Other files there are colocated modules.
- \`vite.config.ts\`: \`lumiose({ mode: "${template.mode}", csp: "strict" })\` sets the default route mode
  and a strict Content Security Policy.
- \`.lumiose/\`: generated types and shadow files (git-ignored).

\`.stsx\` files are TSX with raw-CSS \`<style>\` blocks. The docs for your Lumiose version are in
\`node_modules/lumiose/docs\` (\`npx lumiose docs <topic>\`). Coding agents: see \`AGENTS.md\`.
${
  uiEntry === undefined
    ? ""
    : `
UI components come from \`@lumiose/ui\`: accessible and unstyled, with its default theme imported in
\`${uiEntry}\`. Their docs are in \`node_modules/@lumiose/ui/docs\` (\`npx lumiose docs ui\`).
`
}`;
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path, base);
      return [relative(base, path).split(sep).join("/")];
    }),
  );
  return nested.flat();
}
