import { describe, expect, it } from "vitest";
import type { ClientRuntime } from "./client.ts";
import type { ServerRuntime } from "./server.ts";

// Compile-time conformance: once the runtimes implement the contract, flip these to strict checks:
//   const _client = (await import("../dom/index.ts")) satisfies ClientRuntime;
// Until then, the test only guards that the contract modules stay importable and erasable.
type _Keys = keyof ClientRuntime | keyof ServerRuntime;

describe("compiler-runtime contract", () => {
  it("is importable", async () => {
    const mod = await import("./client.ts");
    expect(mod.TemplateFlags.MultiRoot).toBe(1);
    const keys: _Keys[] = ["template", "ssr"];
    expect(keys).toHaveLength(2);
  });
});
