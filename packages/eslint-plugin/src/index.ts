// `@lumen/eslint-plugin` (TASK-41): the Lumen compiler's diagnostics as lint rules. The compiler is
// the single source of truth: these rules only report what `compile()` reports (`LUMxxxx`, with
// help and fixes), so oxlint, ESLint, `lumen check` and the editor agree.
//
// - oxlint (JS plugins): `"jsPlugins": ["@lumen/eslint-plugin"]` lints `.tsx` files. oxlint cannot
//   parse `.stsx` (no custom file formats yet): `lumen lint` covers those.
// - ESLint 9 (flat config): `configs.recommended` also lints `.stsx` files through the `stsx`
//   processor, which hands ESLint the scanner's masked TSX (offset-identical, so positions and
//   fixes apply to the source). Parse `.tsx` with a TypeScript parser (typescript-eslint).
//
// Not covered: project-wide checks (LUM4003, LUM3012) and `$` constants imported from other
// modules, whose style diagnostics need the module graph: `lumen check` reports those.

import { compile, scan, type Diagnostic } from "@lumen/compiler";

/** The parts of ESLint's rule context the rules use (oxlint implements the same API). */
interface RuleContext {
  filename: string;
  physicalFilename?: string;
  sourceCode: { text: string };
  report(descriptor: {
    loc: { start: Position; end: Position };
    message: string;
    fix?: (fixer: Fixer) => unknown;
  }): void;
}

interface Position {
  /** 1-based. */
  line: number;
  /** 0-based. */
  column: number;
}

interface Fixer {
  replaceTextRange(range: [number, number], text: string): unknown;
}

interface Message {
  ruleId: string | null;
  [key: string]: unknown;
}

/** TypeScript (and ESLint's parser) report syntax errors themselves. */
const REPORTED_BY_PARSERS = new Set(["LUM1001"]);

/** The original text of `.stsx` files being linted through the processor, by physical path. */
const stsxSources = new Map<string, string>();

/** The compiler's diagnostics for a `.stsx` or `.tsx` file (none for other files). */
export function lumenDiagnostics(text: string, filename: string): Diagnostic[] {
  if (!/\.(?:stsx|tsx)$/.test(filename)) return [];
  let diagnostics: Diagnostic[];
  try {
    diagnostics = compile(text, filename, { target: "client", sourceMap: false }).diagnostics;
  } catch {
    return [];
  }
  return diagnostics.filter((diagnostic) => !REPORTED_BY_PARSERS.has(diagnostic.code));
}

/** 1-based line and 0-based column (UTF-16) of `offset` in `text`. */
function position(text: string, offset: number): Position {
  let line = 1;
  let start = 0;
  for (let at = text.indexOf("\n"); at !== -1 && at < offset; at = text.indexOf("\n", at + 1)) {
    line++;
    start = at + 1;
  }
  return { line, column: offset - start };
}

/** `LUM2001: message`, then the help and the docs topic on a line of their own. */
function message(diagnostic: Diagnostic): string {
  const help = diagnostic.help === undefined ? "" : `${diagnostic.help} `;
  return `${diagnostic.code}: ${diagnostic.message}\n${help}(lumen docs ${diagnostic.docs})`;
}

function compilerRule(severities: ReadonlySet<Diagnostic["severity"]>, description: string) {
  return {
    meta: {
      type: "problem" as const,
      docs: {
        description,
        url: "https://github.com/itsjavi/lumen/tree/main/packages/lumen/docs/errors",
      },
      fixable: "code" as const,
      schema: [],
    },
    create(context: RuleContext) {
      const file = context.physicalFilename ?? context.filename;
      const text = stsxSources.get(file) ?? context.sourceCode.text;
      return {
        Program() {
          for (const diagnostic of lumenDiagnostics(text, file)) {
            if (!severities.has(diagnostic.severity)) continue;
            const { fix } = diagnostic;
            context.report({
              loc: {
                start: position(text, diagnostic.span.start),
                end: position(text, Math.max(diagnostic.span.start, diagnostic.span.end)),
              },
              message: message(diagnostic),
              ...(fix === undefined
                ? {}
                : {
                    fix: (fixer: Fixer) =>
                      fix.edits.map((edit) =>
                        fixer.replaceTextRange([edit.span.start, edit.span.end], edit.text),
                      ),
                  }),
            });
          }
        },
      };
    },
  };
}

/** ESLint processor for `.stsx`: lint the masked TSX, which keeps every offset of the source. */
const stsxProcessor = {
  meta: { name: "lumen/stsx", version: "0.0.0" },
  supportsAutofix: true,
  preprocess(text: string, filename: string) {
    stsxSources.set(filename, text);
    return [{ text: scan(text, filename).masked, filename: "component.tsx" }];
  },
  postprocess(messages: Message[][], filename: string): Message[] {
    stsxSources.delete(filename);
    return messages.flat();
  },
};

const plugin = {
  meta: { name: "lumen", version: "0.0.0" },
  rules: {
    /** The compiler's errors (reactivity, styles, islands, …). */
    compiler: compilerRule(new Set(["error"]), "Lumen compiler errors (LUMxxxx)"),
    /** The compiler's warnings and hints. */
    "compiler-warnings": compilerRule(
      new Set(["warning", "hint"]),
      "Lumen compiler warnings and hints (LUMxxxx)",
    ),
  },
  processors: { stsx: stsxProcessor },
  configs: {} as Record<string, unknown>,
};

/** ESLint 9 flat config: `.stsx` through the processor, compiler rules on `.tsx` and `.stsx`. */
plugin.configs["recommended"] = [
  { files: ["**/*.stsx"], plugins: { lumen: plugin }, processor: "lumen/stsx" },
  {
    files: ["**/*.tsx", "**/*.stsx/*.tsx"],
    plugins: { lumen: plugin },
    rules: { "lumen/compiler": "error", "lumen/compiler-warnings": "warn" },
  },
];

export default plugin;
