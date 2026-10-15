// The part of mocha the suites use: `describe`, `it` (sync or async, with `this.weight`) and
// `afterEach`, run in order. Results carry upstream's fields (suite, description, success, weight)
// so scripts/score.ts scores them as the custom-json reporter of Custom Elements Everywhere does.

export interface TestResult {
  suite: string[];
  description: string;
  success: boolean;
  weight: number | undefined;
  log: string[];
}

interface Test {
  suite: string[];
  description: string;
  fn: (this: { weight?: number }) => unknown;
  after: (() => void)[];
}

const suites: string[] = [];
const hooks: (() => void)[][] = [[]];
const tests: Test[] = [];

function describe(name: string, fn: () => void): void {
  suites.push(name);
  hooks.push([]);
  fn();
  hooks.pop();
  suites.pop();
}

function it(description: string, fn: Test["fn"]): void {
  tests.push({ suite: [...suites], description, fn, after: hooks.flat() });
}

function afterEach(fn: () => void): void {
  hooks.at(-1)!.push(fn);
}

Object.assign(globalThis, { describe, it, afterEach });

/** Runs every test defined so far, in order. */
export async function run(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const test of tests) {
    const context: { weight?: number } = {};
    let log: string[] = [];
    try {
      await test.fn.call(context);
    } catch (error) {
      log = [error instanceof Error ? error.message : String(error)];
    }
    for (const hook of test.after) hook();
    results.push({
      suite: test.suite,
      description: test.description,
      success: log.length === 0,
      weight: context.weight,
      log,
    });
  }
  return results;
}
