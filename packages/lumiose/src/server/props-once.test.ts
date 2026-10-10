// @vitest-environment happy-dom
// Server props are evaluated lazily and at most once per component instance (decision-28,
// TASK-151), against real compiler output: the server compiles getter props to closures that
// cache the first read; the client keeps reactive getters. Both render the same HTML.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumiose/compiler";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "../dom/index.ts";
import { renderToString } from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const src = resolve(import.meta.dirname, "..");
const IMPORTS = {
  client: { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
const out = resolve(src, "../test/out/props-once");
mkdirSync(out, { recursive: true });
let counter = 0;

type Module = Record<string, any>;

async function load(source: string, target: "client" | "server"): Promise<Module> {
  const result = compile(source, `/src/case${counter}.tsx`, {
    target,
    styleImport: false,
    sourceMap: false,
  });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  let code = result.code;
  for (const [specifier, file] of Object.entries(IMPORTS[target])) {
    code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
  }
  const path = join(out, `case${counter++}-${Date.now()}.${target}.js`);
  writeFileSync(path, code);
  return (await import(/* @vite-ignore */ path)) as Module;
}

/** Calls of the cases' `track(name, value)`, by name. */
const calls: Record<string, number> = {};
(globalThis as Record<string, unknown>).track = (name: string, value: unknown) => {
  calls[name] = (calls[name] ?? 0) + 1;
  return value;
};

beforeEach(() => {
  for (const name of Object.keys(calls)) delete calls[name];
});
afterEach(() => {
  document.body.textContent = "";
});

const SOURCE = `
declare const track: <T>(name: string, value: T) => T;

function Twice(props: { value: string; unused?: string; children?: JSX.Element }) {
  return <p>{props.value}-{props.value}-{props.children}{props.children}</p>;
}

function Leaf(props: { n: number }) {
  track("leaf", 0);
  return <b>{props.n}</b>;
}

function Options(props: { labels: string[] }) {
  return props.labels.map((label) => <i>{props.labels.length}:{label}</i>);
}

export function Page() {
  return (
    <main>
      <Twice value={track("value", "v")} unused={track("unused", "u")}>
        <Leaf n={track("n", 1)} />
      </Twice>
      {[1, 2].map((i) => <Twice value={track("row", \`r\${i}\`)} />)}
      <Options labels={track("labels", ["a", "b", "c"])} />
    </main>
  );
}
`;

describe.skipIf(!binding)("server props (decision-28)", () => {
  it("evaluates each prop at most once per instance, and unread props never", async () => {
    const server = await load(SOURCE, "server");
    const html = await renderToString(() => server.Page({}));
    expect(calls).toEqual({ value: 1, n: 1, leaf: 1, row: 2, labels: 1 });
    expect(html).toContain("<p>v-v-<b>1</b><b>1</b></p>");
    expect(html).toContain("<p>r1-r1-</p><p>r2-r2-</p>");
    expect(html).toContain("<i>3:a</i><i>3:b</i><i>3:c</i>");
  });

  it("renders the same HTML as the client, whose props stay getters", async () => {
    const [server, client] = [await load(SOURCE, "server"), await load(SOURCE, "client")];
    const html = await renderToString(() => server.Page({}));
    const container = document.createElement("div");
    render(() => client.Page({}), container);
    const parsed = document.createElement("div");
    parsed.innerHTML = html;
    // Client inserts keep empty comment anchors; the elements and text are what must match.
    expect(container.innerHTML.replaceAll("<!---->", "")).toBe(parsed.innerHTML);
    // The client re-reads its getters: more than one evaluation per prop there.
    expect(calls.labels).toBeGreaterThan(1);
  });
});
