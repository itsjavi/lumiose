// Test fixture (not published): an app that streams, turns streaming off from middleware for
// `?bot`, and has a boundary that never settles, with `lumiose({ streamTimeout: "300ms" })`
// (decision-58, TASK-340). The dev server, `lumiose preview` and @lumiose/adapter-node tests run
// the same checks on it.
import { expect } from "vitest";

export const STREAMING_FILES: Record<string, string> = {
  "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ streamTimeout: "300ms" })] };
`,
  "src/middleware.ts": `import { response, type Middleware } from "lumiose";
// The crawler recipe, with a query string standing in for the user agent test.
const middleware: Middleware = (ctx, next) => {
  if (ctx.url.searchParams.has("bot")) response().setStreaming(false);
  return next();
};
export default middleware;
`,
  "src/routes/stream/page.stsx": `import { Suspense } from "lumiose";
export const mode = "server";
async function Slow() {
  const text = await new Promise<string>((done) => setTimeout(() => done("resolved"), 50));
  return <p>{text}</p>;
}
export default function Stream() {
  return (
    <main>
      <h1>Shell</h1>
      <Suspense fallback={<p>Loading</p>}>
        <Slow />
      </Suspense>
    </main>
  );
}
`,
  "src/routes/hang/page.stsx": `import { ErrorBoundary, Suspense } from "lumiose";
export const mode = "server";
async function Hang() {
  const text = await new Promise<string>(() => {});
  return <p>{text}</p>;
}
export default function HangPage() {
  return (
    <main>
      <Suspense fallback={<p>Loading</p>}>
        <ErrorBoundary fallback={(error: Error) => <p>Timed out: {error.message}</p>}>
          <Hang />
        </ErrorBoundary>
      </Suspense>
    </main>
  );
}
`,
  "src/instrumentation.server.ts": `const log: string[] = ((globalThis as any).lumioseStreamingLog ??= []);
export function onRequestError(error: unknown, info: { phase: string; route?: string }) {
  log.push(\`\${info.phase} \${info.route} \${(error as { code?: string }).code}\`);
}
`,
};

/**
 * Checks the fixture served at `get`: a streamed page, the same page fully resolved for `?bot`,
 * and the never-settling boundary ended by the timeout (`dev` shows the error's message, a build a
 * digest).
 */
export async function checkStreaming(
  get: (path: string) => Promise<Response>,
  dev: boolean,
): Promise<void> {
  const log = ((globalThis as { lumioseStreamingLog?: string[] }).lumioseStreamingLog ??= []);
  log.length = 0;

  const streamed = await (await get("/stream")).text();
  expect(streamed).toMatch(/<\?start name="lb0"><p[^>]*>Loading<\/p><\?end>/);
  expect(streamed).toMatch(/<template for="lb0"><p[^>]*>resolved<\/p><\/template>/);

  const resolved = await (await get("/stream?bot")).text();
  expect(resolved).toMatch(/<h1[^>]*>Shell<\/h1><p[^>]*>resolved<\/p><\/main>/);
  expect(resolved).not.toContain("Loading");
  expect(resolved).not.toContain("$swap");

  const started = Date.now();
  const hung = await (await get("/hang")).text();
  expect(Date.now() - started).toBeLessThan(10_000);
  expect(hung).toMatch(
    dev
      ? /<template for="lb0"><p[^>]*>Timed out: [^<]*streamTimeout[^<]*LUM5009/
      : /<template for="lb0"><p[^>]*>Timed out: An error occurred [^<]*\(digest [0-9a-f]{8}\)/,
  );
  expect(log).toEqual(["stream /hang LUM5009"]);
}
