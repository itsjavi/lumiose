// `pnpm --filter @lumiose/ui size`: what each component costs the browser, minified, gzip and
// brotli. Report-only: @lumiose/ui is opt-in, so it is measured apart from the runtime's caps
// (decision-55), and the `lumiose` runtime it imports is left out of every row. Per component:
//
// - Client script: what a server-rendered page loads for it (decision-63): `lu-*` element
//   definitions, or a script that closes a native element's gaps, with the modules it shares with
//   other components' scripts (TASK-541). They are built together, each script an entry, as an
//   app's client build builds them, so the shared modules are chunks of their own; each file is
//   compressed on its own, as it is served, and the cell sums them. An island loads the same files.
// - Component JS: the component compiled for the browser, as an island that uses it loads it.
// - CSS: its stylesheet, the CSS it needs to work (the package is unstyled). Themes are opt-in
//   and reported on their own rows.
//
// Each Component JS and CSS cell is its own Vite build (Rolldown, minified, tree-shaken), so shared
// code counts in every row that needs it, as a page with only that component would load it.

import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { compile } from "@lumiose/compiler";
import { build, type Plugin, type Rollup } from "vite";

const src = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");

interface Component {
  name: string;
  /** The module that exports the component's parts; none for a variant's row. */
  module?: string;
  /** Its client scripts: element definitions or gap scripts (decision-63). */
  scripts: string[];
  /** Its stylesheet; native components (Fieldset, Checkbox, …) need none. */
  css?: string;
}

/** The optional themes (`@lumiose/ui/themes/<name>.css`), all components included. */
const THEMES = ["default"];

const COMPONENTS: Component[] = [
  {
    name: "dialog",
    module: "dialog/dialog.tsx",
    scripts: ["dialog/dialog.script.ts"],
    css: "dialog/dialog.css",
  },
  {
    name: "popover",
    module: "popover/popover.tsx",
    scripts: ["popover/popover.script.ts"],
    css: "popover/popover.css",
  },
  // Only a trigger with `openOnHover` loads the hover timing (TASK-541).
  {
    name: "popover, openOnHover",
    scripts: ["popover/popover.script.ts", "popover/popover-hover.script.ts"],
  },
  {
    name: "tooltip",
    module: "tooltip/tooltip.tsx",
    scripts: ["tooltip/tooltip.script.ts"],
    css: "tooltip/tooltip.css",
  },
  {
    name: "tabs",
    module: "tabs/tabs.tsx",
    scripts: ["tabs/tabs.script.ts"],
    css: "tabs/tabs.css",
  },
  {
    name: "menu",
    module: "menu/menu.tsx",
    scripts: ["menu/menu.script.ts"],
    css: "menu/menu.css",
  },
  {
    name: "combobox",
    module: "combobox/combobox.tsx",
    scripts: ["combobox/combobox.script.ts"],
    css: "combobox/combobox.css",
  },
  {
    name: "select",
    module: "select/select.tsx",
    // Only for items with a `label` (TASK-537).
    scripts: ["select/select.script.ts"],
    css: "select/select.css",
  },
  {
    name: "field",
    module: "field/field.tsx",
    scripts: ["field/field.script.ts"],
    css: "field/field.css",
  },
  { name: "fieldset", module: "fieldset/fieldset.tsx", scripts: [] },
  { name: "form", module: "form/form.tsx", scripts: [] },
  { name: "input", module: "input/input.tsx", scripts: [] },
  {
    name: "checkbox",
    module: "checkbox/checkbox.tsx",
    scripts: ["checkbox/checkbox.script.ts"],
  },
  {
    name: "checkbox-group",
    module: "checkbox-group/checkbox-group.tsx",
    scripts: ["checkbox/checkbox.script.ts"],
  },
  {
    name: "radio-group",
    module: "radio-group/radio-group.tsx",
    scripts: ["checkbox/checkbox.script.ts"],
  },
  { name: "switch", module: "switch/switch.tsx", scripts: ["checkbox/checkbox.script.ts"] },
  {
    name: "collapsible",
    module: "collapsible/collapsible.tsx",
    scripts: ["collapsible/collapsible.script.ts"],
    css: "collapsible/collapsible.css",
  },
  {
    name: "accordion",
    module: "accordion/accordion.tsx",
    scripts: ["accordion/accordion.script.ts"],
    css: "accordion/accordion.css",
  },
  {
    name: "toast",
    module: "toast/toast.tsx",
    scripts: ["toast/toast.script.ts"],
    css: "toast/toast.css",
  },
  { name: "button", module: "button/button.tsx", scripts: ["button/button.script.ts"] },
  { name: "toggle", module: "toggle/toggle.tsx", scripts: [] },
  {
    name: "toggle-group",
    module: "toggle-group/toggle-group.tsx",
    scripts: ["toggle-group/toggle-group.script.ts"],
  },
  { name: "progress", module: "progress/progress.tsx", scripts: [] },
  { name: "meter", module: "meter/meter.tsx", scripts: [] },
  {
    name: "slider",
    module: "slider/slider.tsx",
    scripts: ["slider/slider.script.ts"],
    css: "slider/slider.css",
  },
  {
    name: "context-menu",
    module: "context-menu/context-menu.tsx",
    scripts: ["context-menu/context-menu.script.ts"],
    css: "context-menu/context-menu.css",
  },
  {
    name: "drawer",
    module: "drawer/drawer.tsx",
    scripts: ["dialog/dialog.script.ts", "drawer/drawer.script.ts"],
    css: "drawer/drawer.css",
  },
  {
    name: "number-field",
    module: "number-field/number-field.tsx",
    scripts: ["number-field/number-field.script.ts"],
    css: "number-field/number-field.css",
  },
  {
    name: "autocomplete",
    module: "autocomplete/autocomplete.tsx",
    scripts: ["combobox/combobox.script.ts"],
    css: "combobox/combobox.css",
  },
  {
    name: "separator",
    module: "separator/separator.tsx",
    scripts: [],
    css: "separator/separator.css",
  },
  {
    name: "avatar",
    module: "avatar/avatar.tsx",
    scripts: ["avatar/avatar.script.ts"],
    css: "avatar/avatar.css",
  },
  {
    name: "otp-field",
    module: "otp-field/otp-field.tsx",
    scripts: ["otp-field/otp-field.script.ts"],
    css: "otp-field/otp-field.css",
  },
  {
    name: "preview-card",
    module: "preview-card/preview-card.tsx",
    scripts: ["preview-card/preview-card.script.ts"],
    css: "preview-card/preview-card.css",
  },
  {
    name: "toolbar",
    module: "toolbar/toolbar.tsx",
    scripts: ["toolbar/toolbar.script.ts", "button/button.script.ts"],
    css: "toolbar/toolbar.css",
  },
  {
    name: "scroll-area",
    module: "scroll-area/scroll-area.tsx",
    scripts: ["scroll-area/scroll-area.script.ts"],
    css: "scroll-area/scroll-area.css",
  },
  {
    name: "menubar",
    module: "menubar/menubar.tsx",
    scripts: ["menu/menu.script.ts", "menubar/menubar.script.ts"],
    css: "menubar/menubar.css",
  },
  {
    name: "navigation-menu",
    module: "navigation-menu/navigation-menu.tsx",
    scripts: ["navigation-menu/navigation-menu.script.ts"],
    css: "navigation-menu/navigation-menu.css",
  },
];

const CLIENT_SCRIPT = /\?client$/;

/**
 * Compiles `.tsx` modules for the browser, as @lumiose/vite does in an app, where a client-script
 * import (decision-63) imports the script and exports a function that does nothing.
 */
const lumioseClient: Plugin = {
  name: "compile-for-browser",
  enforce: "pre",
  async resolveId(id, importer) {
    if (!CLIENT_SCRIPT.test(id)) return null;
    const script = await this.resolve(id.replace(CLIENT_SCRIPT, ""), importer);
    return script && `\0client-script:${script.id}`;
  },
  load(id) {
    if (!id.startsWith("\0client-script:")) return null;
    const script = id.slice("\0client-script:".length);
    return `import ${JSON.stringify(script)};\nexport default () => {};`;
  },
  transform(code, id) {
    if (!id.endsWith(".tsx")) return null;
    const result = compile(code, id, { target: "client", sourceMap: false, styleImport: false });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) throw new Error(`${id}: ${errors.map((d) => d.message).join("; ")}`);
    return { code: result.code, map: null };
  },
};

async function bundle(source: string, kind: "js" | "css"): Promise<Buffer> {
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "size-entry",
        resolveId: (id) => (id === "virtual:size-entry" ? "\0size-entry" : undefined),
        load: (id) => (id === "\0size-entry" ? source : undefined),
      },
      lumioseClient,
    ],
    build: {
      write: false,
      minify: true,
      cssMinify: "lightningcss",
      target: "esnext",
      modulePreload: false,
      rollupOptions: {
        input: "virtual:size-entry",
        preserveEntrySignatures: "strict",
        // The runtime is measured by `pnpm --filter lumiose size`.
        external: (id) => /^lumiose(?:\/|$)/.test(id),
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const files = [result].flat().flatMap((output) => output.output);
  return Buffer.concat(
    files.flatMap((file) => {
      if (kind === "js") return file.type === "chunk" ? [Buffer.from(file.code)] : [];
      return file.type === "asset" && file.fileName.endsWith(".css")
        ? [Buffer.from(file.source)]
        : [];
    }),
  );
}

/**
 * Every client script built as an app's client build builds them (decision-63): each an entry,
 * the modules several of them import in chunks of their own.
 */
async function scriptChunks(scripts: string[]): Promise<Rollup.OutputChunk[]> {
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      target: "esnext",
      modulePreload: false,
      rollupOptions: {
        input: Object.fromEntries(scripts.map((script) => [script, `${src}${script}`])),
        preserveEntrySignatures: "strict",
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  return [result]
    .flat()
    .flatMap((output) => output.output)
    .filter((file): file is Rollup.OutputChunk => file.type === "chunk");
}

/** The files a page that runs `scripts` loads: their entries and what those import. */
function loadedFiles(chunks: Rollup.OutputChunk[], scripts: string[]): Buffer[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const files = new Set<string>();
  const visit = (name: string) => {
    if (files.has(name)) return;
    files.add(name);
    for (const imported of byName.get(name)!.imports) visit(imported);
  };
  for (const script of scripts) {
    const entry = chunks.find(
      (chunk) => chunk.isEntry && chunk.facadeModuleId === `${src}${script}`,
    );
    if (!entry) throw new Error(`no entry chunk for ${script}`);
    visit(entry.fileName);
  }
  return [...files].map((name) => Buffer.from(byName.get(name)!.code));
}

const kb = (bytes: number) => (bytes / 1024).toFixed(2);

function measure(bytes: Buffer): [number, number, number] {
  const gzip = gzipSync(bytes, { level: 9 }).length;
  const brotli = brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length;
  return [bytes.length, gzip, brotli];
}

/** Each file compressed on its own, as it is served, and the sums; the files' count if several. */
function cell(files: Buffer | Buffer[]): string {
  const list = [files].flat().filter((file) => file.length > 0);
  if (list.length === 0) return "none";
  const [min, gzip, brotli] = list
    .map(measure)
    .reduce((sum, each) => [sum[0] + each[0], sum[1] + each[1], sum[2] + each[2]]);
  const count = list.length > 1 ? ` (${list.length} files)` : "";
  return `${kb(min)} / ${kb(gzip)} / ${kb(brotli)}${count}`;
}

const imports = (modules: string[]) => modules.map((m) => `import "${src}${m}";`).join("\n");
const css = async (modules: string[]) => cell(await bundle(imports(modules), "css"));

const SCRIPTS = [...new Set(COMPONENTS.flatMap((component) => component.scripts))];
const chunks = await scriptChunks(SCRIPTS);

console.log("@lumiose/ui, min / gzip / brotli in kB (the lumiose runtime is not included)\n");
console.log("| Component | Client script (server pages) | Component JS (islands) | CSS |");
console.log("| --- | --- | --- | --- |");
for (const component of COMPONENTS) {
  const componentJs = component.module
    ? cell(await bundle(`export * from "${src}${component.module}";`, "js"))
    : "";
  const componentCss = component.css ? await css([component.css]) : component.module ? "none" : "";
  console.log(
    `| ${component.name} | ${cell(loadedFiles(chunks, component.scripts))} | ${componentJs} | ${componentCss} |`,
  );
}
for (const theme of THEMES)
  console.log(`| theme: ${theme} | | | ${await css([`themes/${theme}.css`])} |`);
const everything = `export * from "${src}index.ts";`;
console.log(
  `| everything | ${cell(chunks.map((chunk) => Buffer.from(chunk.code)))} | ${cell(await bundle(everything, "js"))} | ${await css(["styles.css"])} |`,
);
