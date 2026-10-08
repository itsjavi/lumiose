// `.svg` imports as inline components (decision-22, TASK-70; owner: Halo, in Photon's plugin).
//
// `import Icon from "./icon.svg"` (or `./icon.svg?inline`) loads a module whose default export
// renders the file inline: `lumen_svg` optimises it with OXVG (SVGO's preset in Rust) and the
// Lumen compiler turns it into a static template for the environment's target, so the component
// is the same on the client, on the server and in islands. Vite's own `?url` and `?raw` keep
// working, and files in `exclude` (node_modules by default) keep Vite's URL import, since a
// dependency importing an `.svg` expects a URL.

import { readFile } from "node:fs/promises";
import { compileSvg } from "@lumen/compiler";
import type { Plugin } from "vite";

/** `lumen({ svg })`: how `.svg` imports become components; `false` leaves them to Vite. */
export interface SvgOptions {
  /** Optimise with OXVG's default preset (SVGO's, in Rust). Default: `true`. */
  optimize?: boolean;
  /**
   * Replace every colour with `currentColor`, for monochrome icons drawn with a hard-coded colour,
   * so that they follow the text colour. Default: `false` (colours are kept).
   */
  currentColor?: boolean;
}

const SVG_COMPONENT = /\.svg(?:\?inline)?$/;

/** Validates `lumen({ svg })`; `false` when `.svg` imports are left to Vite. */
export function svgOptionsOf(svg: unknown): false | Required<SvgOptions> {
  const defaults = { optimize: true, currentColor: false };
  if (svg === undefined || svg === true) return defaults;
  if (svg === false) return false;
  if (typeof svg !== "object" || svg === null || Array.isArray(svg)) {
    throw new TypeError(
      `lumen({ svg }): expected true, false or { optimize, currentColor }, got ${describe(svg)}.`,
    );
  }
  const options = { ...defaults };
  for (const [key, value] of Object.entries(svg)) {
    if (key !== "optimize" && key !== "currentColor") {
      throw new TypeError(
        `lumen({ svg.${key} }): unknown option. Known options: optimize, currentColor.`,
      );
    }
    if (typeof value !== "boolean") {
      throw new TypeError(`lumen({ svg.${key} }): expected true or false, got ${describe(value)}.`);
    }
    options[key as keyof SvgOptions] = value;
  }
  return options;
}

/** The plugin that loads project `.svg` files as components. */
export function svgPlugin(
  options: Required<SvgOptions>,
  exclude: RegExp,
  root: () => string,
): Plugin {
  return {
    name: "lumen:svg",
    enforce: "pre",
    load: {
      filter: { id: SVG_COMPONENT },
      async handler(id) {
        const file = id.replace(/\?inline$/, "");
        if (exclude.test(file)) return null;
        const source = await readFile(file, "utf8");
        const target = this.environment.config.consumer === "server" ? "server" : "client";
        let code: string;
        try {
          ({ code } = compileSvg(source, file, { ...options, target, root: root() }));
        } catch (error) {
          return this.error({ message: (error as Error).message, id: file });
        }
        return { code, map: null, moduleType: "js" };
      },
    },
  };
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "an array";
  if (value === null || typeof value !== "object") return String(value);
  return "an object";
}
