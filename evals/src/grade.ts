// Grading: the task's hidden tests (plus `lumiose check`) run in the project after the agent is
// done. Agents never see the tests; they are copied in only now.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task } from "./tasks.ts";
import { EVALS } from "./workspace.ts";

export interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
}

export interface Grade {
  /** Hidden tests all pass and `lumiose check` reports no errors. */
  success: boolean;
  tests: { passed: number; failed: number; total: number; results: TestResult[] };
  check: { ok: boolean; errors: number; warnings: number; codes: string[] };
  diff: { filesChanged: number; linesAdded: number; linesRemoved: number };
  durationMs: number;
}

const HIDDEN = "eval-hidden";

export function grade(task: Task, dir: string): Grade {
  const started = performance.now();
  const diff = diffStats(dir);
  const check = runCheck(dir);
  const target = join(dir, HIDDEN);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(task.dir, "hidden"), target, { recursive: true });
  cpSync(join(EVALS, "grader/helpers.ts"), join(target, "helpers.ts"));
  writeFileSync(
    join(target, "vitest.config.ts"),
    `import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
  test: {
    root: ${JSON.stringify(dir)},
    include: ["${HIDDEN}/**/*.test.{ts,tsx}"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
`,
  );
  const report = join(target, "report.json");
  spawnSync(
    join(dir, "node_modules/.bin/vitest"),
    [
      "run",
      "--config",
      join(target, "vitest.config.ts"),
      "--reporter=json",
      `--outputFile=${report}`,
    ],
    { cwd: dir, encoding: "utf8", timeout: 600_000, env: { ...process.env, CI: "1" } },
  );
  const results: TestResult[] = [];
  if (existsSync(report)) {
    const json = JSON.parse(readFileSync(report, "utf8")) as {
      testResults: {
        name: string;
        message?: string;
        status: string;
        assertionResults: { fullName: string; status: string; failureMessages: string[] }[];
      }[];
    };
    for (const file of json.testResults) {
      if (file.assertionResults.length === 0) {
        // A file that failed to load (syntax error, missing module the task asked for).
        results.push({
          name: file.name.replace(`${dir}/`, ""),
          ok: false,
          message: (file.message ?? "").slice(0, 2000),
        });
      }
      for (const test of file.assertionResults) {
        results.push({
          name: test.fullName,
          ok: test.status === "passed",
          ...(test.status === "passed"
            ? {}
            : { message: test.failureMessages.join("\n").slice(0, 2000) }),
        });
      }
    }
  } else {
    results.push({
      name: "vitest",
      ok: false,
      message: "the hidden tests did not run (no report)",
    });
  }
  const passed = results.filter((r) => r.ok).length;
  return {
    success: passed === results.length && results.length > 0 && check.ok,
    tests: { passed, failed: results.length - passed, total: results.length, results },
    check,
    diff,
    durationMs: performance.now() - started,
  };
}

function runCheck(dir: string): Grade["check"] {
  const result = spawnSync(
    process.execPath,
    [join(dir, "node_modules/@lumiose/cli/src/bin.ts"), "check", "--format", "json"],
    {
      cwd: dir,
      encoding: "utf8",
      timeout: 300_000,
    },
  );
  try {
    const json = JSON.parse(result.stdout) as {
      ok: boolean;
      diagnostics: { code: string; severity: string }[];
      summary: { errors: number; warnings: number };
    };
    return {
      ok: json.ok,
      errors: json.summary.errors,
      warnings: json.summary.warnings,
      codes: [...new Set(json.diagnostics.map((d) => d.code))].toSorted(),
    };
  } catch {
    return { ok: false, errors: 1, warnings: 0, codes: ["(check crashed)"] };
  }
}

/** What the agent changed, relative to the starting commit (new files included). */
function diffStats(dir: string): Grade["diff"] {
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const numstat = execFileSync(
    "git",
    ["diff", "--cached", "--numstat", "HEAD", "--", ".", ":!pnpm-lock.yaml"],
    {
      cwd: dir,
      encoding: "utf8",
    },
  );
  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of numstat.trim().split("\n")) {
    if (!line) continue;
    const [added, removed] = line.split("\t");
    filesChanged++;
    linesAdded += Number(added) || 0;
    linesRemoved += Number(removed) || 0;
  }
  return { filesChanged, linesAdded, linesRemoved };
}
