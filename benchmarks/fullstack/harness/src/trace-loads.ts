// Preloaded into an app's production server by the runtime-dependency metric (measure.ts,
// `runtimeDependencies`) through NODE_OPTIONS=--import: appends the URL of every file module the
// process resolves, by `import` or `require`, to the file named by BENCH_TRACE_LOADS.
import { appendFileSync } from "node:fs";
import { registerHooks } from "node:module";

const log = process.env.BENCH_TRACE_LOADS;

if (log !== undefined && log !== "") {
  const seen = new Set<string>();
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      if (result.url.startsWith("file:") && !seen.has(result.url)) {
        seen.add(result.url);
        appendFileSync(log, `${result.url}\n`);
      }
      return result;
    },
  });
}
