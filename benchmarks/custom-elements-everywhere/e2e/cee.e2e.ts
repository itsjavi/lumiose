// Runs the suites in the page (src/main.ts) in each engine and writes the results to
// results/<engine>.json for scripts/score.ts. Every test must pass: a regression fails here.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { TestResult } from "../src/mocha.ts";

test("Custom Elements Everywhere", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => "ceeResults" in window);
  const results = await page.evaluate(
    () => (window as unknown as { ceeResults: TestResult[] }).ceeResults,
  );
  const dir = new URL("../results/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL(`${browserName}.json`, dir), `${JSON.stringify(results, null, 2)}\n`);
  expect(errors).toEqual([]);
  expect(results).toHaveLength(16);
  expect(results.filter((result) => !result.success)).toEqual([]);
});
