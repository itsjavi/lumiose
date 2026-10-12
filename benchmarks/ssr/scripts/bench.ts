// Runs the SSR throughput benchmark and writes RESULTS.md. Each framework renders in fresh Node
// processes (NODE_ENV=production, --expose-gc), interleaved over rounds so drift hits all alike.
//
//   node scripts/build.ts && node scripts/bench.ts [--rounds 2] [--runs 5] [--run-ms 1000] [--warmup-ms 3000]

import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, cpus, loadavg, platform, release, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import type { RunResult } from "./run.ts";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(join(root, "package.json"));

const { values } = parseArgs({
  options: {
    rounds: { type: "string", default: "2" },
    runs: { type: "string", default: "5" },
    "run-ms": { type: "string", default: "1000" },
    "warmup-ms": { type: "string", default: "3000" },
    output: { type: "string", default: "RESULTS.md" },
  },
});
const rounds = Number(values.rounds);
const runs = Number(values.runs);
const runMs = Number(values["run-ms"]);
const warmupMs = Number(values["warmup-ms"]);

interface Framework {
  id: string;
  name: string;
  /** Package whose version is reported. */
  pkg: string;
  mode: string;
}

const FRAMEWORKS: Framework[] = [
  {
    id: "lumiose",
    name: "Lumiose",
    pkg: "lumiose",
    mode: "`renderToString` (lumiose/server), compiled `.stsx` (server target)",
  },
  {
    id: "solid",
    name: "Solid",
    pkg: "solid-js",
    mode: '`renderToString`, babel-preset-solid `generate: "ssr"`, not hydratable',
  },
  {
    id: "solid-hydratable",
    name: "Solid (hydratable)",
    pkg: "solid-js",
    mode: "same, `hydratable: true` (hydration keys)",
  },
  {
    id: "solid-2",
    name: "Solid 2 (RC)",
    pkg: "solid-js-2",
    mode: '**pre-release** (`solid-js@next`): `renderToString` (@solidjs/web), @solidjs/compiler `generate: "ssr"`, not hydratable, from the same source as Solid',
  },
  {
    id: "svelte",
    name: "Svelte",
    pkg: "svelte",
    mode: '`render` (svelte/server), `generate: "server"`',
  },
  {
    id: "vue",
    name: "Vue",
    pkg: "vue",
    mode: "`renderToString` (vue/server-renderer), SFC templates compiled with `ssr: true`",
  },
  {
    id: "react",
    name: "React",
    pkg: "react-dom",
    mode: "`renderToString` (react-dom/server), automatic JSX runtime",
  },
  {
    id: "preact",
    name: "Preact",
    pkg: "preact",
    mode: '`renderToString` (preact-render-to-string), automatic JSX runtime (`importSource: "preact"`)',
  },
  {
    id: "astro",
    name: "Astro",
    pkg: "astro",
    mode: "`renderToString` of the Container API (`experimental_AstroContainer`), `.astro` components compiled by Astro's Vite pipeline (`getViteConfig`)",
  },
  {
    id: "remix",
    name: "Remix 3",
    pkg: "remix",
    mode: '`renderToString` (remix/component/server), setup/render components, JSX compiled as `remix/node-tsx` does (Oxc, `jsxImportSource: "remix/component"`)',
  },
];

function version(pkg: string): string {
  return (
    JSON.parse(readFileSync(require.resolve(`${pkg}/package.json`), "utf8")) as { version: string }
  ).version;
}

async function runOnce(framework: Framework): Promise<RunResult> {
  const { stdout } = await exec(
    process.execPath,
    ["--expose-gc", "scripts/run.ts", framework.id, String(runs), String(runMs), String(warmupMs)],
    { cwd: root, env: { ...process.env, NODE_ENV: "production" }, maxBuffer: 1 << 20 },
  );
  return JSON.parse(stdout.trim().split("\n").at(-1)!) as RunResult;
}

const loadBefore = loadavg()[0]!;
const samples = new Map<string, number[]>(FRAMEWORKS.map((framework) => [framework.id, []]));
const bytes = new Map<string, number>();
for (let round = 1; round <= rounds; round++) {
  for (const framework of FRAMEWORKS) {
    process.stdout.write(`round ${round}/${rounds}: ${framework.name}… `);
    const result = await runOnce(framework);
    samples.get(framework.id)!.push(...result.runs);
    bytes.set(framework.id, result.bytes);
    console.log(result.runs.map((value) => value.toFixed(0)).join(", "));
  }
}

const stats = FRAMEWORKS.map((framework) => {
  const rates = samples.get(framework.id)!;
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / (rates.length - 1);
  return {
    framework,
    mean,
    stdev: Math.sqrt(variance),
    n: rates.length,
    bytes: bytes.get(framework.id)!,
  };
}).toSorted((a, b) => b.mean - a.mean);
const best = stats[0]!.mean;
const load = `${loadBefore.toFixed(1)} → ${loadavg()[0]!.toFixed(1)}`;

const rows = stats.map(
  ({ framework, mean, stdev, n, bytes: size }) =>
    `| ${framework.name} | ${version(framework.pkg)} | ${mean.toFixed(1)} ± ${stdev.toFixed(1)} | ${(1000 / mean).toFixed(2)} | ${(best / mean).toFixed(2)}× | ${(size / 1024).toFixed(0)} kB | ${n} |`,
);
const modes = FRAMEWORKS.map((framework) => `- **${framework.name}:** ${framework.mode}.`);
const cpu = cpus()[0]?.model ?? "unknown CPU";
const date = new Date().toISOString().slice(0, 10);

const markdown = `# SSR throughput benchmark: results

Renders per second of the same page (higher is better), to a complete HTML string in one Node
process per framework. Generated by \`node scripts/bench.ts\`; method and caveats below.

**Run:** ${date}, Node ${process.version}, ${cpu} (${cpus().length} cores, ${(totalmem() / 2 ** 30).toFixed(0)} GB), ${platform()} ${release()} ${arch()}.
${rounds} rounds × ${runs} runs of ${runMs} ms per framework, after ${warmupMs} ms of warmup in each process.
1-minute load average ${load} (other work on the machine adds noise).

| Framework | Version | Renders/s (mean ± stdev) | ms/render | vs. fastest | HTML | Runs |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

## The page

\`src/data.ts\` builds 1,000 deterministic rows. The page is a header with a nav, a 1,000-row
table and a footer summary; each row is a \`Row\` component with a nested \`Tags\` list (3 items)
and a \`Badge\` (children), so the page renders about 5,000 component instances. Labels,
descriptions, URLs and tags are full of \`<\`, \`>\`, \`&\`, \`"\` and \`'\`, in text and in attributes.
Every implementation renders the same elements, classes and attributes; \`scripts/run.ts\`
checks each output (row, tag and badge counts, escaping, the summary) before measuring.

${modes.join("\n")}

## Method

- \`scripts/build.ts\` compiles each implementation with the framework's own compiler, server
  target, as its bundler plugin would, into \`dist/<framework>/\`. Runtimes load from
  \`node_modules\` with \`NODE_ENV=production\` (production builds of React and Vue). The
  exception is Solid 2 (RC): it is installed next to Solid 1.9 (as \`solid-js-2\`), and its
  runtime \`@solidjs/web\` imports \`solid-js\`, so \`dist/solid-2/render.js\` bundles that runtime
  (production builds, not minified) with \`solid-js\` resolved to the 2.0 package.
- \`scripts/run.ts\` renders once and checks the HTML, warms up for ${warmupMs} ms, then counts
  renders in back-to-back ${runMs} ms runs, with a full GC (\`--expose-gc\`) before each run.
  Async renderers (Lumiose, Vue, Astro, Remix 3) are awaited; sync ones (Solid, Svelte,
  React, Preact) are not. Each render then reads one character of its result: renderers build
  the page by concatenation, which V8 keeps as a tree of pieces, and the read makes V8 join
  them into one string, the work a server does anyway when it writes the response.
- \`scripts/bench.ts\` runs every framework in a fresh process per round, interleaving the
  frameworks across rounds, and reports the mean and sample standard deviation of all runs.

## Notes

- Output size differs with each framework's markers and escaping: Svelte adds \`<!--[-->\`
  block markers and whitespace, Vue fragment markers, React \`<!-- -->\` text separators, Solid
  (hydratable) \`data-hk\` keys. Lumiose emits hydration markers only inside islands (none here)
  and leaves attribute values unquoted when that is valid. Lumiose, Solid and Svelte escape only
  \`<\` and \`&\` in text (and \`"\` and \`&\` in attributes), which is valid HTML and cheaper than
  also escaping \`>\` and quotes.
- Lumiose's \`renderToString\` is \`renderToStream\` with \`resolveAll\`: the same path as
  prerendering and the streamed shell (lazy owners, async frames and the head collector
  included).
- Lumiose went from 338 to about 540 renders/s with TASK-71 (escaping with \`indexOf\` scans and
  only the characters HTML requires, plain class strings memoized, owners created only when a
  component uses one), then to about 660 with TASK-78 in the code compiled for component calls:
  literal children and trivially safe server props (literals, local identifiers, single-level
  \`props.x\`) are data properties instead of getters, and a server branch renders its chosen
  side in place (\`branchArm\`) instead of through closures. Deeper reads such as
  \`tags={props.item.tags}\` stay lazy getters, so they run when the child reads them, as on the
  client.
- On 2026-10-12 (TASK-246) the benchmark started flattening each result (above), which lowers
  every framework that returns its page as concatenated pieces (Solid by about 15%) and not
  those that already return a flat string. Measured on that method, Lumiose gained about 12%
  over its previous runtime and compiler: compiled templates concatenate their parts directly
  when every hole is synchronous (+8%), the unsafe URL check skips its regexes for values that
  cannot hold a scheme (+2.6%), and text holes take a string fast path (+0.6%).
- The quiet-machine run of 2026-10-12 before TASK-246 (ef81f5b, without flattening) measured
  Lumiose at about 560 renders/s, down from about 660 on 2026-10-08 (a5d73ef). TASK-244 bisected
  it with both builds loaded into one process and measured alternately: the unsafe URL check in
  server \`attr()\` (TASK-168) cost about 7%, and evaluating deep prop reads at most once per
  instance (decision-28, TASK-151) about 4% without flattening (none with it). Since TASK-246,
  Lumiose renders the page as fast as a5d73ef without flattening, and 7-10% faster with it.
- Versions are pinned exactly in \`package.json\` and are the latest stable releases when
  measured (decision-41). Solid 2 is a release candidate: it is an extra, labelled entry next to
  stable Solid, not a replacement.
- **Astro** renders through the Container API, the documented way to render \`.astro\`
  components to a string. Each render is a partial (no doctype or head) but still goes through
  a full request: a \`Request\`, the render context and \`Astro\` globals, then a \`Response\`
  whose streamed body is read back with \`text()\`. The number includes that per-request
  framework overhead, as a real Astro page would. Its runtime loads from \`node_modules\`;
  \`astro build\` would bundle it into the server build instead (the same code, not minified
  either way). Astro also escapes \`>\` and \`'\` in text.
- **Remix 3** has no build step: \`remix/node-tsx\` compiles JSX with Oxc when Node loads a
  module. \`scripts/build.ts\` runs the same transform ahead of time. Its \`renderToString\`
  drains \`renderToStream\`'s byte stream (async, with frame support) and strips its flush
  markers.
- **Preact** renders synchronously with \`preact-render-to-string\`. Preact, Remix 3 and Astro
  emit no text separators or hydration markers here. Remix 3 writes \`data-id\` before
  \`class\` on rows (attribute order is not significant).
- Marko 6 is not included yet.
- One machine, one Node version: compare ratios, not absolute numbers, and rerun before
  drawing conclusions from small differences.
`;

writeFileSync(join(root, values.output!), markdown);
console.log(`\nWrote ${values.output}`);
