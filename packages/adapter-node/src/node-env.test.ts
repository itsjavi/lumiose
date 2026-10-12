// NODE_ENV of a served build (TASK-149): "production" unless set explicitly, before the build's
// entry (and what it imports) is evaluated.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHandler } from "./server.ts";

declare global {
  // oxlint-disable-next-line no-var -- a global the fake entry writes
  var nodeEnvAtEntry: string | undefined;
}

/** A minimal build output whose entry records NODE_ENV when it is evaluated. */
function fakeBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), "lumiose-node-env-"));
  mkdirSync(join(dir, "server"), { recursive: true });
  mkdirSync(join(dir, "client"), { recursive: true });
  writeFileSync(
    join(dir, "server", "entry.js"),
    `globalThis.nodeEnvAtEntry = process.env.NODE_ENV;
export const config = { base: "/", trailingSlash: "ignore", assetsDir: "assets" };
const handler = { fetch: () => new Response("ok") };
export const createHandler = () => handler;
export default handler;
`,
  );
  return dir;
}

describe("NODE_ENV", () => {
  let saved: string | undefined;
  const dirs: string[] = [];

  beforeEach(() => {
    saved = process.env.NODE_ENV;
    globalThis.nodeEnvAtEntry = undefined;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to production before the build's entry is loaded", async () => {
    delete process.env.NODE_ENV;
    const dir = fakeBuild();
    dirs.push(dir);
    await createHandler({ dir });
    expect(globalThis.nodeEnvAtEntry).toBe("production");
    expect(process.env.NODE_ENV).toBe("production");
  });

  it("keeps an explicit value", async () => {
    process.env.NODE_ENV = "staging";
    const dir = fakeBuild();
    dirs.push(dir);
    await createHandler({ dir });
    expect(globalThis.nodeEnvAtEntry).toBe("staging");
  });
});
