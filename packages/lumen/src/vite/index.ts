// `lumen/vite`: the Vite 8 plugin (owner: Photon; spec §5.5, decision-5).
//
// - Compiles `.stsx` and `.tsx` modules (outside node_modules) with the native Lumen compiler,
//   before Vite's own OXC transform, which is told to skip them. The target follows the Vite
//   environment: `lumen/server` code for server consumers (SSR), `lumen/dom` code otherwise.
// - Compiler diagnostics become Vite warnings and errors with code frames (the dev overlay).
// - `lumen` resolves its `browser` export in client environments and its `node` export in server
//   environments; Vite processes it in both (never externalized or pre-bundled), so compiled code
//   and the runtime share one module instance.
// - HMR (v1): a client module that imports `mount` from `lumen/dom` (an app entry) accepts
//   updates of itself and of every module it reaches, so an edit re-runs the entry, which
//   re-mounts the app into the same container after disposing the previous root. Component state
//   is reset; module-level signals of unchanged modules survive. Per-component hot replacement
//   can come later without changing this contract.
// - Style blocks import `<id>?lumen&type=style&lang.css`; until the CSS pipeline lands (TASK-45)
//   that module is empty.
// - `virtual:lumen/islands` is the island manifest (./islands.ts). Island refs are root-relative
//   (`/src/components/Team.stsx#TeamPanel`) for modules inside the Vite root.

import { compile, type Diagnostic } from "@lumen/compiler";
import {
  defaultClientConditions,
  defaultServerConditions,
  type EnvironmentOptions,
  type Plugin,
  type ViteDevServer,
} from "vite";
import { ISLANDS, ISLANDS_ID, IslandRegistry } from "./islands.ts";

export interface LumenOptions {
  /** Modules compiled by Lumen. Default: `.stsx` and `.tsx` files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
}

const LUMEN_MODULE = /\.(?:stsx|tsx)$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;
/** Vite's default OXC exclusion, kept when Lumen files are added to it. */
const VITE_OXC_EXCLUDE = /\.js$/;
/** Every entry point of the `lumen` package (kept out of dependency pre-bundling). */
const LUMEN_ENTRIES = [
  "lumen",
  "lumen/dom",
  "lumen/dom/hydrate",
  "lumen/server",
  "lumen/router",
  "@lumen/compiler",
];
const STYLE_QUERY = /\?lumen&type=style&lang\.css$/;
const HMR_DOM = "virtual:lumen/hmr-dom";
const HMR_DOM_ID = "\0lumen:hmr-dom";
// The compiler prints user imports verbatim, normalized by the code printer.
const IMPORTS_MOUNT = /import\s*\{[^}]*\bmount\b[^}]*\}\s*from\s*"lumen\/dom"/;

export default function lumen(options: LumenOptions = {}): Plugin[] {
  const include = options.include ?? LUMEN_MODULE;
  const exclude = options.exclude ?? NODE_MODULES;
  let serve = false;
  let root = process.cwd();
  let devServer: ViteDevServer | undefined;
  const islands = new IslandRegistry();
  return [
    {
      name: "lumen",
      enforce: "pre",

      config(config, env) {
        serve = env.command === "serve";
        const oxc = config.oxc;
        // `oxc: false` disables Vite's transform altogether; an explicit include/exclude is the
        // user's call. Otherwise Lumen modules are added to Vite's default exclusion.
        if (oxc === false || oxc?.include !== undefined || oxc?.exclude !== undefined) return;
        return { oxc: { exclude: [VITE_OXC_EXCLUDE, include] } };
      },

      configResolved(config) {
        root = config.root;
      },

      configureServer(server) {
        devServer = server;
      },

      configEnvironment(name, config) {
        const server = (config.consumer ?? (name === "client" ? "client" : "server")) === "server";
        const out: EnvironmentOptions = {
          resolve: {
            // Explicit per consumer: `browser` → src/index.ts, `node` → src/index.server.ts.
            conditions: config.resolve?.conditions ?? [
              ...(server ? defaultServerConditions : defaultClientConditions),
            ],
          },
          optimizeDeps: { exclude: LUMEN_ENTRIES },
        };
        if (server) out.resolve!.noExternal = ["lumen"];
        return out;
      },

      resolveId: {
        filter: { id: /^virtual:lumen\/(?:hmr-dom|islands)$/ },
        handler: (id) => (id === ISLANDS ? ISLANDS_ID : HMR_DOM_ID),
      },

      load: {
        filter: { id: [/^\0lumen:(?:hmr-dom|islands)$/, STYLE_QUERY] },
        handler(id) {
          if (id === HMR_DOM_ID) return HMR_DOM_CODE;
          if (id === ISLANDS_ID) {
            islands.scan(root, include, exclude);
            return islands.code();
          }
          // `<file>?lumen&type=style&lang.css`: Vite's CSS plugin takes it from here. The scoped
          // styles of the file are compiled by the CSS pipeline (TASK-45); empty until then.
          return "";
        },
      },

      transform: {
        filter: { id: { include, exclude } },
        handler(code, id) {
          const server = this.environment.config.consumer === "server";
          const result = compile(code, id, {
            target: server ? "server" : "client",
            sourceMap: true,
            root,
          });
          if (islands.add(result.meta.islands) && devServer) {
            // A call site the manifest has not seen: the next import gets the new manifest.
            const graph = devServer.environments.client.moduleGraph;
            const manifest = graph.getModuleById(ISLANDS_ID);
            if (manifest) graph.invalidateModule(manifest);
          }
          for (const diagnostic of result.diagnostics) {
            if (diagnostic.severity !== "error") {
              this.warn(message(diagnostic), diagnostic.span.start);
            }
          }
          const errors = result.diagnostics.filter((d) => d.severity === "error");
          if (errors.length > 0) {
            const [first, ...rest] = errors;
            const more = rest.map((d) => `\n${message(d)}`).join("");
            this.error({ message: message(first!) + more, id }, first!.span.start);
          }
          let out = result.code;
          if (serve && !server && IMPORTS_MOUNT.test(out)) out = hmrEntry(out);
          return { code: out, map: result.map, moduleType: "js" };
        },
      },
    },
  ];
}

function message(diagnostic: Diagnostic): string {
  let text = `${diagnostic.code}: ${diagnostic.message}`;
  if (diagnostic.help) text += `\nhelp: ${diagnostic.help}`;
  return text;
}

/**
 * An app entry in dev: its `lumen/dom` imports go through the HMR wrapper (whose `mount` disposes
 * the previous root of the same container) and the module accepts updates, so an edit anywhere
 * below it re-runs it with the updated modules.
 */
function hmrEntry(code: string): string {
  return (
    code.replaceAll('from "lumen/dom"', `from "${HMR_DOM}"`) +
    "\nif (import.meta.hot) import.meta.hot.accept();\n"
  );
}

const HMR_DOM_CODE = `import { mount as mountRoot } from "lumen/dom";
export * from "lumen/dom";
const roots = (globalThis.__LUMEN_HMR_ROOTS__ ??= new Map());
export function mount(code, container) {
  roots.get(container)?.();
  const dispose = mountRoot(code, container);
  roots.set(container, dispose);
  return () => {
    if (roots.get(container) === dispose) roots.delete(container);
    dispose();
  };
}
`;
