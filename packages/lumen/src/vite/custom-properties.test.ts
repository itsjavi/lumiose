// The project-wide LUM3012 check (TASK-62) through a real Vite 8 client build: a custom property
// set in a `style` prop is reported only when no stylesheet of the project reads it.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { build, type Rollup } from "vite";
import { CustomPropertyCheck, cssReads } from "./custom-properties.ts";
import lumen from "./index.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const lumenRoot = resolve(import.meta.dirname, "../..");

const FILES: Record<string, string> = {
  "main.tsx": `import "./app.css";
import { mount } from "lumen/dom";
import { Bar } from "./Bar.stsx";
mount(() => <Bar pct={5} />, document.body);
`,
  "app.css": `body { color: var(--page-fg, black); }\n`,
  // --fill: its own CSS; --gap: the child's CSS; --page-fg: app.css; --progres: a typo.
  "Bar.stsx": `import { Track } from "./Track.stsx";
export function Bar(props: { pct: number }) {
  return (
    <div class="bar" style={{ "--fill": \`\${props.pct}%\`, "--progres": 1, "--page-fg": "red" }}>
      <Track style="--gap: 2px" />
      <style>.bar { inline-size: var(--fill); }</style>
    </div>
  );
}
`,
  "Track.stsx": `export function Track(props: { style?: string }) {
  return <span class="track" style={props.style}><style>.track { gap: var(--gap); }</style></span>;
}
`,
};

let root: string | undefined;

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!binding)("LUM3012 in lumen build", () => {
  it("reports only the custom properties no stylesheet of the project reads", async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-custom-properties-")));
    for (const [name, code] of Object.entries(FILES)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), code);
    }
    mkdirSync(join(root, "node_modules"));
    symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
    const warnings: Rollup.RollupLog[] = [];
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [lumen()],
      build: {
        write: false,
        rolldownOptions: {
          input: join(root, "main.tsx"),
          onwarn: (warning) => void warnings.push(warning),
        },
      },
    });
    const lum3012 = warnings.filter((w) => w.message.includes("LUM3012"));
    expect(lum3012).toHaveLength(1);
    expect(lum3012[0]!.message).toContain("`--progres` is set in a `style` prop");
    expect(lum3012[0]!.loc).toMatchObject({ file: join(root, "Bar.stsx"), line: 4 });
  }, 30_000);
});

describe("CustomPropertyCheck", () => {
  it("reads var() names, including fallbacks", () => {
    expect(cssReads(".a { color: var( --x, var(--y-2) ); --z: 1; }")).toEqual(["--x", "--y-2"]);
  });

  it("keeps earlier reads when a compile has no CSS, and positions are 1-based lines", () => {
    const check = new CustomPropertyCheck();
    const source = "const a = 1;\nconst b = <p style={{ '--k': 1 }} />;\n";
    const start = source.indexOf("--k");
    const meta = (read: string[]) => ({
      customProperties: { set: [{ name: "--k", span: { start, end: start + 3 } }], read },
    });
    check.module("/a.stsx", source, { css: "", meta: meta(["--k"]) } as never);
    check.module("/a.stsx", source, { css: null, meta: meta([]) } as never);
    expect(check.unread()).toEqual([]);
    check.stylesheet("/a.stsx", "");
    expect(check.unread()).toEqual([
      { file: "/a.stsx", name: "--k", start, end: start + 3, line: 2, column: 23 },
    ]);
  });
});
