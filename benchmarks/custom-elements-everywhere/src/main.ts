// The test page: defines mocha's globals, loads the two suites, runs them and leaves the results on
// `window.ceeResults` for e2e/cee.e2e.ts.
import { run } from "./mocha.ts";

await import("./basic-tests.tsx");
await import("./advanced-tests.tsx");
(window as unknown as { ceeResults: unknown }).ceeResults = await run();
