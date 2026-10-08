// TextMate tokenization of `.stsx` with the extension's grammar, as VS Code does it: the grammar
// embeds `source.tsx` and `source.css`, taken here from `tm-grammars` (the same upstream grammars
// VS Code ships in its typescript-basics and css extensions).

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import oniguruma from "vscode-oniguruma";
import textmate from "vscode-textmate";

const require = createRequire(import.meta.url);

const GRAMMARS: Record<string, string> = {
  "source.stsx": fileURLToPath(new URL("../syntaxes/stsx.tmLanguage.json", import.meta.url)),
  "source.tsx": require.resolve("tm-grammars/grammars/tsx.json"),
  "source.css": require.resolve("tm-grammars/grammars/css.json"),
};

export interface Token {
  line: number;
  /** 1-based. */
  column: number;
  text: string;
  /** Innermost last, without the root `source.stsx`. */
  scopes: string[];
}

let grammar: Promise<textmate.IGrammar> | undefined;

function loadGrammar(): Promise<textmate.IGrammar> {
  grammar ??= (async () => {
    const wasm = await readFile(require.resolve("vscode-oniguruma/release/onig.wasm"));
    await oniguruma.loadWASM(wasm.buffer as ArrayBuffer);
    const registry = new textmate.Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
        createOnigString: (text) => new oniguruma.OnigString(text),
      }),
      loadGrammar: async (scopeName) => {
        const path = GRAMMARS[scopeName];
        if (path === undefined) return null;
        return textmate.parseRawGrammar(await readFile(path, "utf8"), path);
      },
    });
    const loaded = await registry.loadGrammar("source.stsx");
    if (!loaded) throw new Error("source.stsx grammar did not load");
    return loaded;
  })();
  return grammar;
}

export async function tokenize(source: string): Promise<Token[]> {
  const loaded = await loadGrammar();
  const tokens: Token[] = [];
  let state = textmate.INITIAL;
  source.split(/\r?\n/).forEach((lineText, index) => {
    const result = loaded.tokenizeLine(lineText, state);
    for (const token of result.tokens) {
      tokens.push({
        line: index + 1,
        column: token.startIndex + 1,
        text: lineText.slice(token.startIndex, token.endIndex),
        scopes: token.scopes.slice(1),
      });
    }
    state = result.ruleStack;
  });
  return tokens;
}

/** One line per non-blank token: `line:column "text" scopes…` (a readable snapshot format). */
export function formatTokens(tokens: readonly Token[]): string {
  return tokens
    .filter((token) => token.text.trim() !== "")
    .map(
      (token) =>
        `${token.line}:${token.column} ${JSON.stringify(token.text)} ${token.scopes.join(" ")}`,
    )
    .join("\n")
    .concat("\n");
}
