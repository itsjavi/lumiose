// Source maps of @lumiose/stsx (TASK-580): production and dev JS maps name only the `.stsx` file
// (never the virtual `X.stsx.tsx`), with its content, and map code back to its line; CSS maps map
// rules back to their `<style>` block.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { build, createLogger, createServer, type PluginOption, type Rolldown } from "vite";
import { sharedCacheDir } from "../test/project.ts";
import stsx from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url));

interface RawMap {
  sources: string[];
  sourcesContent?: (string | null)[];
  mappings: string;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(segment: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    let digit = BASE64.indexOf(char);
    const more = digit & 32;
    digit &= 31;
    value += digit << shift;
    if (more) shift += 5;
    else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

/** The original `[source, line (1-based), column]` of the segment at or before a generated position. */
function originalPosition(map: RawMap, line: number, column: number) {
  let source = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let found: [string, number, number] | undefined;
  map.mappings.split(";").forEach((text, generatedLine) => {
    let generatedColumn = 0;
    for (const segment of text.split(",").filter(Boolean)) {
      const fields = vlq(segment);
      generatedColumn += fields[0]!;
      if (fields.length < 4) continue;
      source += fields[1]!;
      sourceLine += fields[2]!;
      sourceColumn += fields[3]!;
      if (generatedLine === line && generatedColumn <= column) {
        found = [map.sources[source]!, sourceLine + 1, sourceColumn];
      }
    }
  });
  return found;
}

/** The generated line and column of the first occurrence of `text`. */
function locate(code: string, text: string): [number, number] {
  const lines = code.split("\n");
  const line = lines.findIndex((l) => l.includes(text));
  return [line, lines[line]!.indexOf(text)];
}

/** The 1-based line of `text` in the fixture file. */
function lineOf(file: string, text: string): number {
  return (
    readFileSync(file, "utf8")
      .split("\n")
      .findIndex((l) => l.includes(text)) + 1
  );
}

async function productionMap(name: string, plugins: PluginOption[]) {
  const output = (await build({
    root: fixture(name),
    configFile: false,
    logLevel: "silent",
    plugins,
    build: {
      write: false,
      sourcemap: true,
      minify: false,
      rolldownOptions: { input: `${fixture(name)}/main.tsx` },
    },
  })) as Rolldown.RolldownOutput;
  const chunk = output.output.find((item) => item.type === "chunk")!;
  if (chunk.type !== "chunk") throw new Error("no chunk");
  return { code: chunk.code, map: chunk.map as unknown as RawMap };
}

describe.skipIf(!binding)("stsx() source maps", () => {
  it("map React production code to the .stsx source", async () => {
    const { code, map } = await productionMap("react", [
      stsx({ classAttribute: "className" }),
      react(),
    ]);
    const stsxSources = map.sources.filter((source) => source.includes(".stsx"));
    expect(stsxSources.length).toBeGreaterThan(0);
    for (const source of stsxSources) expect(source).toMatch(/App\.stsx$/);
    const [line, column] = locate(code, "function Counter()");
    const original = originalPosition(map, line, column)!;
    expect(original[0]).toMatch(/App\.stsx$/);
    expect(original[1]).toBe(lineOf(`${fixture("react")}/App.stsx`, "export function Counter"));
    const index = map.sources.indexOf(original[0]);
    expect(map.sourcesContent?.[index]).toContain("<style>");
  });

  it("map Solid production code to the .stsx source", async () => {
    const { map } = await productionMap("solid", [stsx({ classAttribute: "class" }), solid()]);
    const stsxSources = map.sources.filter((source) => source.includes(".stsx"));
    expect(stsxSources.length).toBeGreaterThan(0);
    for (const source of stsxSources) expect(source).toMatch(/App\.stsx$/);
  });

  it("map dev code and stylesheets to the .stsx source", async () => {
    const server = await createServer({
      root: fixture("react"),
      cacheDir: sharedCacheDir("sourcemap"),
      configFile: false,
      customLogger: createLogger("silent"),
      plugins: [stsx({ classAttribute: "className" }), react()],
      appType: "custom",
      css: { devSourcemap: true },
      server: { middlewareMode: true, ws: false, watch: null },
    });
    try {
      const file = `${fixture("react")}/App.stsx`;
      const js = await server.environments.client.transformRequest("/App.stsx");
      const jsMap = js!.map as unknown as RawMap;
      expect(jsMap.sources.every((source) => !source.endsWith(".stsx.tsx"))).toBe(true);
      const [line, column] = locate(js!.code, "function Counter()");
      const original = originalPosition(jsMap, line, column)!;
      expect(original[0]).toMatch(/App\.stsx$/);
      expect(original[1]).toBe(lineOf(file, "export function Counter"));

      const css = await server.environments.client.transformRequest("/App.stsx.css");
      const inline = /sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/.exec(
        css!.code,
      )![1]!;
      const cssMap = JSON.parse(Buffer.from(inline, "base64").toString()) as RawMap;
      expect(cssMap.sources.some((source) => source.endsWith("App.stsx"))).toBe(true);
      const styles = JSON.parse(/const __vite__css = (".*?");?\n/.exec(css!.code)![1]!) as string;
      const [ruleLine, ruleColumn] = locate(styles, ".page[");
      const rule = originalPosition(cssMap, ruleLine, ruleColumn)!;
      expect(rule[1]).toBe(lineOf(file, ".page {"));
    } finally {
      await server.close();
    }
  });
});
