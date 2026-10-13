// `.svg` imports as inline components (decision-22, decision-46, TASK-70, TASK-96, TASK-270;
// owner: Halo, in Photon's plugin).
//
// `import Icon from "./icon.svg?component"` loads a module whose default export renders the file
// inline: SVGO optimises it, then `compileSvg` (lumiose_svg) removes scripts, event handlers and
// `javascript:` URLs, prefixes its ids per file and has the Lumiose compiler turn it into a static
// template for the environment's target, so the component is the same on the client, on the
// server and in islands. The query is the opt-in, so it works for any file, `node_modules`
// included (icon sets), and every other `.svg` import (bare, `?url`, `?raw`, `?inline`) is Vite's.

import { readFile } from "node:fs/promises";
import { compileSvg } from "@lumiose/compiler";
import type { Config as SvgoConfig, PluginConfig } from "svgo";
import type { Plugin } from "vite";

export type { SvgoConfig };

/** `lumiose({ svg })`: how `.svg?component` imports are compiled; `false` leaves them to Vite. */
export interface SvgOptions {
  /**
   * Optimise with SVGO: `true` uses Lumiose's defaults (`preset-default`, plus
   * `convertStyleToAttrs` for strict CSPs), an object is your own SVGO config (`plugins`,
   * `multipass`, `floatPrecision`…), `false` skips SVGO. Sanitisation and id prefixing always
   * run. Default: `true`.
   */
  optimize?: boolean | SvgoConfig;
  /**
   * Replace every colour with `currentColor`, for monochrome icons drawn with a hard-coded colour,
   * so that they follow the text colour (SVGO's `convertColors`, before any other plugin).
   * Default: `false` (colours are kept).
   */
  currentColor?: boolean;
}

/** Validated `lumiose({ svg })`. */
export interface ResolvedSvgOptions {
  optimize: boolean | SvgoConfig;
  currentColor: boolean;
}

/**
 * An `.svg` id with `component` among its query parameters: in dev, Vite adds others around it
 * (`?component&v=<hash>` for files in `node_modules`).
 */
const SVG_COMPONENT = /\.svg\?(?:[^#]*&)?component(?:&|$)/;

/** Validates `lumiose({ svg })`; `false` when `.svg` imports are left to Vite. */
export function svgOptionsOf(svg: unknown): false | ResolvedSvgOptions {
  const options: ResolvedSvgOptions = { optimize: true, currentColor: false };
  if (svg === undefined || svg === true) return options;
  if (svg === false) return false;
  if (!isObject(svg)) {
    throw new TypeError(
      `lumiose({ svg }): expected true, false or { optimize, currentColor }, got ${describe(svg)}.`,
    );
  }
  for (const [key, value] of Object.entries(svg)) {
    if (key === "optimize") {
      if (typeof value !== "boolean" && !isObject(value)) {
        throw new TypeError(
          `lumiose({ svg.optimize }): expected true, false or an SVGO config, got ${describe(value)}.`,
        );
      }
      options.optimize = value as boolean | SvgoConfig;
    } else if (key === "currentColor") {
      if (typeof value !== "boolean") {
        throw new TypeError(
          `lumiose({ svg.currentColor }): expected true or false, got ${describe(value)}.`,
        );
      }
      options.currentColor = value;
    } else {
      throw new TypeError(
        `lumiose({ svg.${key} }): unknown option. Known options: optimize, currentColor.`,
      );
    }
  }
  return options;
}

/** The SVGO config for `options`, or `null` when SVGO does not run. */
export function svgoConfigOf(options: ResolvedSvgOptions, path: string): SvgoConfig | null {
  const { optimize, currentColor } = options;
  const convertColors: PluginConfig = { name: "convertColors", params: { currentColor: true } };
  if (optimize === false) return currentColor ? { path, plugins: [convertColors] } : null;
  if (optimize === true) {
    // `convertStyleToAttrs` first, so that the preset's colour and default-value passes see
    // style declarations, and again after it, since `inlineStyles` moves `<style>` rules into
    // `style` attributes.
    const preset: PluginConfig = currentColor
      ? { name: "preset-default", params: { overrides: { convertColors: { currentColor: true } } } }
      : "preset-default";
    return { path, plugins: ["convertStyleToAttrs", preset, "convertStyleToAttrs"] };
  }
  // `datauri` would turn the output into a URL.
  const { datauri: _, plugins = ["preset-default"], ...config } = optimize;
  return { ...config, path, plugins: currentColor ? [convertColors, ...plugins] : plugins };
}

let svgo: Promise<typeof import("svgo")> | undefined;

/** The plugin that loads `.svg?component` imports as components. */
export function svgPlugin(options: ResolvedSvgOptions, root: () => string): Plugin {
  return {
    name: "lumiose:svg",
    enforce: "pre",
    load: {
      filter: { id: SVG_COMPONENT },
      async handler(id) {
        const file = id.slice(0, id.indexOf("?"));
        let source = await readFile(file, "utf8");
        const config = svgoConfigOf(options, file);
        let unparsed: Error | undefined;
        if (config) {
          svgo ??= import("svgo");
          try {
            source = (await svgo).optimize(source, config).data;
          } catch (error) {
            // A file SVGO cannot parse goes to `compileSvg` as is, which reports the XML error
            // with its position (or accepts what SVGO's parser did not).
            if ((error as Error).name !== "SvgoParserError") {
              return this.error({ message: `SVGO: ${(error as Error).message}`, id: file });
            }
            unparsed = error as Error;
          }
        }
        const target = this.environment.config.consumer === "server" ? "server" : "client";
        let code: string;
        try {
          ({ code } = compileSvg(source, file, { target, root: root() }));
        } catch (error) {
          return this.error({ message: (error as Error).message, id: file });
        }
        if (unparsed) {
          this.warn({
            message: `not optimised, SVGO could not parse it: ${unparsed.message}`,
            id: file,
          });
        }
        return { code, map: null, moduleType: "js" };
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "an array";
  if (value === null || typeof value !== "object") return String(value);
  return "an object";
}
