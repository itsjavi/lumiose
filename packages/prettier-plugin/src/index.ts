// `@lumiose/prettier-plugin` (TASK-41): Prettier formats `.stsx` files the way `lumiose fmt` does, with
// Prettier's own printers. `lumiose fmt`'s algorithm (@lumiose/cli/tooling `formatStsx`) does the work:
// the TSX with every style block replaced by a placeholder goes through Prettier's TypeScript
// printer, each block's CSS through its CSS printer (`$` references protected), and the blocks are
// re-indented at their placement. Files with scanner or syntax errors are reported, not changed.
//
//   // .prettierrc.json
//   { "plugins": ["@lumiose/prettier-plugin"] }
//
// oxfmt (which `lumiose fmt` uses) has no plugin API, so this is the way to keep Prettier for `.stsx`.

import { formatStsx, type FormatConfig, type Formatter } from "@lumiose/cli/tooling";
import { format, type Plugin } from "prettier";

/** The Prettier options that shape TSX and CSS output, passed on to both printers. */
const FORMAT_OPTIONS = [
  "printWidth",
  "tabWidth",
  "useTabs",
  "semi",
  "singleQuote",
  "jsxSingleQuote",
  "quoteProps",
  "trailingComma",
  "bracketSpacing",
  "bracketSameLine",
  "objectWrap",
  "arrowParens",
  "singleAttributePerLine",
  "endOfLine",
] as const;

/** The parsed file: already formatted, since the work happens in the (async) parser. */
interface StsxDocument {
  type: "stsx";
  formatted: string;
}

/** Formats TSX or CSS with Prettier, in the shape `formatStsx` expects from oxfmt. */
const prettierFormatter: Formatter = async (fileName, source, options) => {
  try {
    const parser = fileName.endsWith(".css") ? "css" : "typescript";
    return { code: await format(source, { ...options, parser }), errors: [] };
  } catch (error) {
    return { code: source, errors: [{ message: (error as Error).message }] };
  }
};

export const languages: Plugin["languages"] = [
  {
    name: "Lumiose STSX",
    parsers: ["stsx"],
    extensions: [".stsx"],
    vscodeLanguageIds: ["stsx"],
  },
];

export const parsers: Plugin<StsxDocument>["parsers"] = {
  stsx: {
    astFormat: "lumiose-stsx",
    async parse(text, options) {
      const config: FormatConfig = {};
      for (const key of FORMAT_OPTIONS) {
        const value = (options as unknown as Record<string, unknown>)[key];
        if (value !== undefined) config[key] = value;
      }
      const file = typeof options.filepath === "string" ? options.filepath : "component.stsx";
      const result = await formatStsx(text, file, prettierFormatter, config);
      if (!result.ok) throw new SyntaxError(`${file}: ${result.error}`);
      return { type: "stsx", formatted: result.code };
    },
    locStart: () => 0,
    locEnd: (node) => node.formatted.length,
  },
};

export const printers: Plugin<StsxDocument>["printers"] = {
  "lumiose-stsx": {
    print: (path) => path.node.formatted,
  },
};

const plugin: Plugin<StsxDocument> = { languages, parsers, printers };
export default plugin;
