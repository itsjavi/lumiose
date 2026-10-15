// `pnpm size`: what each option's elements and CSS cost the browser, per widget, minified, gzip
// and brotli (TASK-332). Each row is its own Vite library build of the modules listed, so shared
// code is counted in every row that needs it, as a page with only that widget would load it.
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { build, type Plugin, type Rollup } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const timeless = "@timelessui/components";

const rows: { option: string; widget: string; modules: string[] }[] = [
  { option: "a", widget: "dialog", modules: [`${timeless}/register/ui-dialog`] },
  {
    option: "a",
    widget: "menu",
    modules: [`${timeless}/register/ui-menu-button`, `${timeless}/register/ui-menu`],
  },
  { option: "a", widget: "combobox", modules: [`${timeless}/register/ui-combobox`] },
  { option: "a", widget: "all three", modules: ["/src/option-a/elements.ts"] },
  { option: "a", widget: "CSS (3 tiers)", modules: ["/src/option-a/theme.css"] },
  { option: "b", widget: "dialog", modules: [] },
  { option: "b", widget: "menu", modules: ["/src/option-b/menu.element.ts"] },
  { option: "b", widget: "combobox", modules: ["/src/option-b/combobox.element.ts"] },
  { option: "b", widget: "all three", modules: ["/src/option-b/elements.ts"] },
  { option: "b", widget: "CSS", modules: ["/src/option-b/theme.css"] },
];

/** A virtual entry that imports `modules` for their side effects. */
function entry(modules: string[]): Plugin {
  return {
    name: "size-entry",
    resolveId: (id) => (id === "virtual:entry" ? "\0entry" : null),
    load: (id) =>
      id === "\0entry" ? modules.map((m) => `import ${JSON.stringify(m)};`).join("\n") : null,
  };
}

async function measure(modules: string[]): Promise<Buffer> {
  if (modules.length === 0) return Buffer.alloc(0);
  const result = (await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [entry(modules)],
    build: {
      write: false,
      minify: true,
      cssMinify: "lightningcss",
      modulePreload: false,
      rollupOptions: { input: "virtual:entry" },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const files = [result].flat().flatMap((output) => output.output);
  return Buffer.concat(
    files.map((file) => Buffer.from(file.type === "chunk" ? file.code : file.source)),
  );
}

const kB = (bytes: number) => (bytes / 1000).toFixed(2);
console.log("| Option | Widget | min (kB) | gzip (kB) | brotli (kB) |");
console.log("| --- | --- | ---: | ---: | ---: |");
for (const row of rows) {
  const code = await measure(row.modules);
  const gzip = code.length ? gzipSync(code, { level: 9 }).length : 0;
  const brotli = code.length ? brotliCompressSync(code).length : 0;
  console.log(
    `| ${row.option} | ${row.widget} | ${kB(code.length)} | ${kB(gzip)} | ${kB(brotli)} |`,
  );
}
