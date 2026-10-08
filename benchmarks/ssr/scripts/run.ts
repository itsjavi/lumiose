// Measures one framework in this process: `node --expose-gc scripts/run.ts <framework>` (with
// NODE_ENV=production). Checks the rendered HTML, warms up, then counts renders in fixed-length
// runs and prints one JSON line: { framework, bytes, runs: renders/s per run }.

import { createPageData } from "../src/data.ts";

export interface RunResult {
  framework: string;
  /** Size of the rendered HTML, UTF-8 bytes. */
  bytes: number;
  /** Renders per second, one value per run. */
  runs: number[];
}

type Render = (data: ReturnType<typeof createPageData>) => string | Promise<string>;

const framework = process.argv[2];
if (framework === undefined)
  throw new Error("Usage: node scripts/run.ts <framework> [runs] [runMs] [warmupMs]");
const runs = Number(process.argv[3] ?? 10);
const runMs = Number(process.argv[4] ?? 1000);
const warmupMs = Number(process.argv[5] ?? 3000);

const { render } = (await import(`../dist/${framework}/render.js`)) as { render: Render };
const data = createPageData();

/** One render; sync renderers stay sync (no microtask per render). */
function once(): string | Promise<string> {
  return render(data);
}

/** Renders until `ms` elapsed; resolves to renders per second. */
async function measure(ms: number): Promise<number> {
  let count = 0;
  const start = performance.now();
  const end = start + ms;
  let now = start;
  while (now < end) {
    const html = once();
    if (typeof html !== "string") await html;
    count++;
    now = performance.now();
  }
  return (count * 1000) / (now - start);
}

const html = await once();
verify(html);

await measure(warmupMs);
const results: number[] = [];
for (let i = 0; i < runs; i++) {
  (globalThis as { gc?: () => void }).gc?.();
  results.push(await measure(runMs));
}
const result: RunResult = { framework, bytes: Buffer.byteLength(html), runs: results };
console.log(JSON.stringify(result));

/** The page must be complete and escaped, whatever the framework's markers and quoting. */
function verify(output: string): void {
  const count = (pattern: RegExp) => output.match(pattern)?.length ?? 0;
  const problems: string[] = [];
  if (count(/<tr[\s>]/g) !== data.items.length + 1)
    problems.push(`expected ${data.items.length + 1} <tr>`);
  if (count(/<li[^>]*class="?tag"?[\s>]/g) !== data.items.length * 3)
    problems.push("expected 3 tags per row");
  if (count(/class="?badge (?:ok|off)"?/g) !== data.items.length)
    problems.push("expected a badge per row");
  if (output.includes("<script>alert(")) problems.push("unescaped description");
  // `>` (and quotes in text) may stay unescaped: valid HTML, and some frameworks skip them.
  if (!/Ships with &lt;script(?:&gt;|>)alert\(/.test(output))
    problems.push("escaped description missing");
  if (!/Catalog &lt;beta(?:&gt;|>) &amp; friends/.test(output))
    problems.push("escaped title missing");
  if (!/title="[^"]*&(?:quot|#34|#x22);/.test(output))
    problems.push("escaped title attribute missing");
  // Text separators (`<!-- -->`, `<!--!-->`, …) and hydration markers are framework business.
  const text = output.replaceAll(/<!--[^]*?-->/g, "");
  const total = data.items.reduce((sum, item) => sum + item.price, 0);
  if (
    !text.includes(
      `1000 items, ${data.items.filter((item) => item.active).length} active, total $${total.toFixed(2)}`,
    )
  ) {
    problems.push("summary missing");
  }
  if (problems.length > 0) {
    throw new Error(
      `${framework}: the rendered page is wrong: ${problems.join("; ")}\n${output.slice(0, 2000)}`,
    );
  }
}
