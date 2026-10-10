// The live preview: the compiled client module runs in a sandboxed iframe (scripts, forms and
// dialogs, but no same-origin access, so shared code cannot reach the site's origin) against the
// real runtime. The parent sends the runtime bundle (public/generated/runtime.js), the module and
// its CSS by postMessage; the frame turns them into blob modules, mounts the component and reports
// console output and errors.

import type { CompileResult } from "@lumiose/compiler";

/** What the frame runs. */
export interface PreviewProgram {
  /** The client module, without the style import (its CSS is `css`). */
  code: string;
  css: string;
  /** The export to mount (`default` or a name); null runs the module without mounting. */
  mount: string | null;
}

/** Messages from the frame. */
export type PreviewMessage =
  | { source: "lumiose-preview"; type: "loaded" }
  | { source: "lumiose-preview"; type: "mounted" }
  | {
      source: "lumiose-preview";
      type: "console";
      level: "log" | "info" | "warn" | "error";
      text: string;
    }
  | { source: "lumiose-preview"; type: "error"; text: string };

const STYLE_IMPORT = /^import\s+["'][^"']*\?lumiose&type=style[^"']*["'];?\n?/gm;

/** The program for a client compile: which component to mount, and the code without its CSS import. */
export function previewProgram(client: CompileResult): PreviewProgram {
  const code = client.code.replace(STYLE_IMPORT, "");
  const exported = client.meta.components.filter((component) => component.exported);
  const hasDefault = /^export default\b|\bas default\b/m.test(code);
  const named = exported.find((component) => component.name === "App") ?? exported[0];
  return {
    code,
    css: client.css ?? "",
    mount: hasDefault ? "default" : (named?.name ?? null),
  };
}

/**
 * Points the module's `lumiose` imports at the runtime modules; any other import is an error, since
 * the playground has a single file. Runs in the frame too (its source is inlined there).
 */
export function rewriteImports(code: string, modules: Record<string, string>): string {
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"'\n]+)\2/g,
    (match: string, keyword: string, quote: string, specifier: string) => {
      const url = modules[specifier];
      if (url !== undefined) return `${keyword}${quote}${url}${quote}`;
      if (specifier.startsWith("blob:")) return match;
      throw new Error(
        `Cannot import "${specifier}" in the playground: it has one file, and only "lumiose" and "lumiose/dom" to import from.`,
      );
    },
  );
}

/** The frame's script: everything it does, in one inline module. */
function frameScript(): string {
  return `
const send = (type, data = {}) => parent.postMessage({ source: "lumiose-preview", type, ...data }, "*");
const show = (value) => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || value.message;
  try { return JSON.stringify(value); } catch { return String(value); }
};
for (const level of ["log", "info", "warn", "error"]) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    send("console", { level, text: args.map(show).join(" ") });
  };
}
addEventListener("error", (event) => send("error", { text: show(event.error ?? event.message) }));
addEventListener("unhandledrejection", (event) => send("error", { text: show(event.reason) }));
const rewriteImports = ${rewriteImports.toString()};
const moduleUrl = (text) => URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
const IDENTIFIER = /^[A-Za-z_$][\\w$]*$/;
addEventListener("message", async (event) => {
  if (event.source !== parent || event.data?.source !== "lumiose-playground") return;
  const { runtime, program } = event.data;
  try {
    const runtimeUrl = moduleUrl(runtime);
    const exports = await import(runtimeUrl);
    const shim = (name) =>
      moduleUrl(
        \`import { \${name} as m } from "\${runtimeUrl}";\\n\` +
          Object.keys(exports[name])
            .filter((key) => IDENTIFIER.test(key))
            .map((key) => \`export const \${key} = m.\${key};\`)
            .join("\\n"),
      );
    const modules = { lumiose: shim("lumiose"), "lumiose/dom": shim("dom") };
    const style = document.createElement("style");
    style.textContent = program.css;
    document.head.append(style);
    const app = moduleUrl(rewriteImports(program.code, modules));
    if (program.mount === null) {
      await import(app);
    } else {
      await import(
        moduleUrl(
          \`import { \${program.mount === "default" ? "default" : program.mount} as App } from "\${app}";\\n\` +
            \`import { createComponent, mount } from "\${modules["lumiose/dom"]}";\\n\` +
            \`mount(() => createComponent(App, {}), document.getElementById("app"));\`,
        )
      );
    }
    send("mounted");
  } catch (error) {
    send("error", { text: show(error) });
  }
});
send("loaded");
`;
}

/** The frame's document (`srcdoc`): an empty page that inherits the site's color scheme. */
export function previewDocument(theme: "light" | "dark" | undefined): string {
  return `<!doctype html>
<html lang="en"${theme === undefined ? "" : ` style="color-scheme: ${theme}"`}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 1rem; }
</style>
<script type="module">${frameScript()}</script>
</head>
<body><div id="app"></div></body>
</html>`;
}
