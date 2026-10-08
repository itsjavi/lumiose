// Writes a new Lumen project: a template's `src/` (and extras), the generated package.json,
// tsconfig.json (extending the generated one, decision-25), vite.config.ts with the template's `lumen({ mode })` (decision-21),
// .gitignore and README, then the agent files (AGENTS.md, CLAUDE.md, the lumen skill,
// .gitattributes) from `lumen/agents`, shared with `lumen agents init`.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { agentsInit, type AgentFile } from "lumen/agents";
import lumenPackage from "lumen/package.json" with { type: "json" };
import { formatTsconfig } from "lumen/tooling";

export type TemplateName = "minimal" | "static" | "ssr" | "spa";

export interface Template {
  name: TemplateName;
  /** The project default route mode, `lumen({ mode })`. */
  mode: "static" | "server" | "spa";
  description: string;
}

export const TEMPLATES: readonly Template[] = [
  { name: "minimal", mode: "static", description: "One static page: the smallest Lumen app" },
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

/** Tool versions the generated package.json asks for (lumen and its adapter share a version). */
const VERSIONS = {
  lumen: `^${lumenPackage.version}`,
  vite: lumenPackage.peerDependencies.vite,
  typescript: "^7.0.2",
  oxlint: "^1.87.0",
  oxfmt: "^0.72.0",
};

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
  files.set("package.json", packageJson(name, template));
  files.set("tsconfig.json", formatTsconfig());
  files.set("vite.config.ts", viteConfig(template));
  files.set(".gitignore", "node_modules\ndist\n.lumen\n");
  files.set("README.md", readme(name, template));

  for (const [file, text] of files) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    await writeFile(join(dir, file), text);
  }
  const agentFiles = await agentsInit(dir, { name });
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
      .replace(/^[-._]+|-+$/g, "") || "lumen-app"
  );
}

export function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(name) && name.length <= 214;
}

function packageJson(name: string, template: Template): string {
  const server = template.mode === "server";
  // The adapter serves `lumen preview` everywhere and is the production server of `ssr`.
  const adapter = { "@lumen/adapter-node": VERSIONS.lumen };
  const manifest = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "lumen dev",
      build: "lumen build",
      preview: "lumen preview",
      ...(server ? { start: "node server.ts" } : {}),
      check: "lumen check",
      lint: "lumen lint",
      fmt: "lumen fmt",
    },
    dependencies: { ...(server ? adapter : {}), lumen: VERSIONS.lumen },
    devDependencies: {
      ...(server ? {} : adapter),
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
  return `import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // The default mode of every route: "static" (built HTML), "server" (rendered per request) or
  // "spa" (rendered in the browser). A route or layout overrides it with \`export const mode\`.
  plugins: [lumen({ mode: "${template.mode}" })],
});
`;
}

function readme(name: string, template: Template): string {
  const server = template.mode === "server";
  return `# ${name}

${template.description}. Made with Lumen (\`create-lumen --template ${template.name}\`).

## Commands

- \`pnpm dev\`: start the dev server with hot reload.
- \`pnpm build\`: build into \`dist/\` and prerender the static routes.
- \`pnpm preview\`: serve the build locally.${server ? "\n- `pnpm start`: serve the build in production (`server.ts`, `@lumen/adapter-node`)." : ""}
- \`pnpm check\`: type-check and report Lumen diagnostics (\`--format json\` for tools).
- \`pnpm lint\` and \`pnpm fmt\`: lint and format, \`.stsx\` files and \`<style>\` blocks included.

## Layout

- \`src/routes/\`: pages (\`.stsx\`) and endpoints (\`.ts\`); the file path is the URL.
- \`vite.config.ts\`: \`lumen({ mode: "${template.mode}" })\` sets the default route mode.
- \`.lumen/\`: generated types and shadow files (git-ignored).

\`.stsx\` files are TSX with raw-CSS \`<style>\` blocks. The docs for your Lumen version are in
\`node_modules/lumen/docs\` (\`npx lumen docs <topic>\`). Coding agents: see \`AGENTS.md\`.
`;
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
