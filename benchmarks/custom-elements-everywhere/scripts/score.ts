// Scores results/<engine>.json the way Custom Elements Everywhere's custom-json reporter does:
// the weighted share of passing tests over Chrome and Firefox (upstream's browsers), plus passed
// and total per suite. WebKit is scored on its own. Writes results/summary.json and prints it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { TestResult } from "../src/mocha.ts";

const dir = new URL("../results/", import.meta.url);

function load(engine: string): TestResult[] | undefined {
  const file = new URL(`${engine}.json`, dir);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as TestResult[]) : undefined;
}

function score(tests: TestResult[]): number {
  let sum = 0;
  let weights = 0;
  for (const test of tests) {
    if (test.weight === undefined) throw new Error(`Missing weight! Test: ${test.description}`);
    sum += (test.success ? 100 : 0) * test.weight;
    weights += test.weight;
  }
  return Math.round(sum / weights);
}

function support(type: string, tests: TestResult[]) {
  const suite = tests.filter((test) => test.suite.includes(type));
  const passed = suite.filter((test) => test.success).length;
  return { total: suite.length, failed: suite.length - passed, passed };
}

function summary(tests: TestResult[]) {
  return {
    score: score(tests),
    basicSupport: support("basic support", tests),
    advancedSupport: support("advanced support", tests),
  };
}

const chromium = load("chromium");
const firefox = load("firefox");
const webkit = load("webkit");
if (chromium === undefined || firefox === undefined) {
  console.error(
    "Run `pnpm test:e2e` first: results/chromium.json and results/firefox.json are missing.",
  );
  process.exit(1);
}
const out = {
  upstream: summary([...chromium, ...firefox]),
  ...(webkit === undefined ? {} : { webkit: summary(webkit) }),
};
writeFileSync(new URL("summary.json", dir), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
