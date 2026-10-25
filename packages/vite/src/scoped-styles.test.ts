// `lumiose({ scopedStyles })` (decision-85): every strategy and specificity, in dev (server-rendered
// HTML and the CSS module) and in a production build, with `:deep()` and class passthrough. The
// markers in the HTML must be the ones the selectors match.
import { linkLumiose } from "./test-links.ts";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createLogger, createServer, normalizePath, type Rolldown } from "vite";
import lumiose from "./index.ts";
import type { ScopedStylesOption } from "./scoped-styles.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const CARD = `import { Chip } from "./Chip.tsx";

export function Card() {
  return (
    <div class="wrap">
      <Chip class="cta" label="chip" />
      <style>
        .wrap :deep(em) { font-style: normal; }
        .cta { font-weight: bold; }
      </style>
    </div>
  );
}
`;
const CHIP = `export function Chip(props: { class?: string; label: string }) {
  return <span class={props.class}><em>{props.label}</em></span>;
}
`;

let root: string;

beforeAll(() => {
  if (!binding) return;
  root = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-scoped-"))));
  writeFileSync(join(root, "Card.stsx"), CARD);
  writeFileSync(join(root, "Chip.tsx"), CHIP);
  linkLumiose(root);
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const CASES: [ScopedStylesOption | undefined, (token: string) => Expectations][] = [
  [
    undefined,
    (t) => ({
      wrap: `<div class=wrap data-lum-${t}>`,
      chip: `<span class="cta" data-lum-${t}>`,
      selectors: [`.wrap[data-lum-${t}] em`, `.cta[data-lum-${t}]`],
    }),
  ],
  [
    { specificity: "zero", namespace: "app" },
    (t) => ({
      wrap: `<div class=wrap data-app-${t}>`,
      chip: `<span class="cta" data-app-${t}>`,
      selectors: [`.wrap:where([data-app-${t}]) em`, `.cta:where([data-app-${t}])`],
    }),
  ],
  [
    { strategy: "class" },
    (t) => ({
      wrap: `<div class="wrap lum-${t}">`,
      chip: `<span class="cta lum-${t}">`,
      selectors: [`.wrap.lum-${t} em`, `.cta.lum-${t}`],
    }),
  ],
  [
    { strategy: "class", specificity: "zero" },
    (t) => ({
      wrap: `<div class="wrap lum-${t}">`,
      chip: `<span class="cta lum-${t}">`,
      selectors: [`.wrap:where(.lum-${t}) em`, `.cta:where(.lum-${t})`],
    }),
  ],
];

interface Expectations {
  wrap: string;
  chip: string;
  selectors: string[];
}

describe.skipIf(!binding)("scopedStyles", () => {
  for (const [option, expected] of CASES) {
    const label = JSON.stringify(option ?? "default");

    it(`renders and styles ${label} in dev`, async () => {
      const server = await createServer({
        root,
        configFile: false,
        customLogger: createLogger("silent"),
        plugins: [lumiose(option === undefined ? {} : { scopedStyles: option })],
        appType: "custom",
        server: { middlewareMode: true, ws: false, watch: null },
      });
      try {
        const { Card } = await server.ssrLoadModule("/Card.stsx");
        const { renderToString } = await server.ssrLoadModule("lumiose/server");
        const html: string = await renderToString(() => Card({}));
        const token = /(?:data-(?:lum|app)-|lum-)([0-9a-z]{8})/.exec(html)![1]!;
        const { wrap, chip, selectors } = expected(token);
        expect(html).toContain(wrap);
        expect(html).toContain(chip);
        const css = await server.environments.client.transformRequest(
          "/Card.stsx?lumiose&type=style&lang.css",
        );
        for (const selector of selectors) expect(css!.code).toContain(selector);
      } finally {
        await server.close();
      }
    });

    it(`builds ${label} for production`, async () => {
      const output = (await build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [lumiose(option === undefined ? {} : { scopedStyles: option })],
        build: {
          write: false,
          minify: false,
          rolldownOptions: { input: `${root}/Card.stsx`, preserveEntrySignatures: "exports-only" },
        },
      })) as Rolldown.RolldownOutput;
      const css = output.output.find((item) => item.fileName.endsWith(".css"));
      const chunks = output.output.filter((item) => item.type === "chunk");
      const source = css?.type === "asset" ? String(css.source) : "";
      const code = chunks.map((chunk) => (chunk.type === "chunk" ? chunk.code : "")).join("\n");
      const token = /(?:data-(?:lum|app)-|lum-)([0-9a-z]{8})/.exec(code)![1]!;
      for (const selector of expected(token).selectors) expect(source).toContain(selector);
      // The template carries the same markers (attributes, or classes in `class`).
      expect(code).toContain(
        option?.strategy === "class" ? `class="wrap lum-${token}"` : `-${token}`,
      );
    });
  }
});
